package com.cinescope.guide

import android.app.*
import android.content.*
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.*
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.io.*
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

/**
 * MovieVerse Background Download Service
 *
 * A robust Android Foreground Service that:
 * 1. Continues downloading reliably even when the app is closed / swiped away
 * 2. Emits direct in-process events to DownloadBridge + explicit package broadcasts
 * 3. Automatic resume & retry on network disconnects using HTTP Range headers
 * 4. Shows download progress in the status-bar notification tray
 * 5. Saves files to public Downloads/movieverse folder
 * 6. Supports multiple parallel downloads
 */
class DownloadService : Service() {

    companion object {
        const val CHANNEL_ID       = "movieverse_downloads"
        const val CHANNEL_NAME     = "MovieVerse Downloads"
        const val NOTIF_ID_BASE    = 7000
        const val FOREGROUND_ID    = 6999
        const val TAG              = "MVDownloadService"

        // Actions
        const val ACTION_START  = "com.cinescope.guide.DOWNLOAD_START"
        const val ACTION_CANCEL = "com.cinescope.guide.DOWNLOAD_CANCEL"

        // Broadcast actions sent back to JS
        const val BROADCAST_PROGRESS  = "com.cinescope.guide.DOWNLOAD_PROGRESS"
        const val BROADCAST_COMPLETE   = "com.cinescope.guide.DOWNLOAD_COMPLETE"
        const val BROADCAST_ERROR      = "com.cinescope.guide.DOWNLOAD_ERROR"

        // Intent extras
        const val EXTRA_URL      = "url"
        const val EXTRA_TITLE    = "title"
        const val EXTRA_FILENAME = "filename"
        const val EXTRA_TASK_ID  = "task_id"

        /** Convenience helper: start a new download from anywhere */
        fun startDownload(ctx: Context, taskId: String, url: String, filename: String, title: String) {
            val intent = Intent(ctx, DownloadService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_TASK_ID, taskId)
                putExtra(EXTRA_URL, url)
                putExtra(EXTRA_FILENAME, filename)
                putExtra(EXTRA_TITLE, title)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent)
            } else {
                ctx.startService(intent)
            }
        }

        /** Convenience helper: cancel a running download */
        fun cancelDownload(ctx: Context, taskId: String) {
            val intent = Intent(ctx, DownloadService::class.java).apply {
                action = ACTION_CANCEL
                putExtra(EXTRA_TASK_ID, taskId)
            }
            ctx.startService(intent)
        }
    }

    private data class DownloadJob(
        val taskId: String,
        val url: String,
        val filename: String,
        val title: String,
        @Volatile var cancelled: Boolean = false,
        @Volatile var progress: Int = 0
    )

    private val executor = Executors.newFixedThreadPool(3)
    private val activeJobs = ConcurrentHashMap<String, DownloadJob>()
    private var notifManager: NotificationManagerCompat? = null
    private val handler = Handler(Looper.getMainLooper())

    override fun onCreate() {
        super.onCreate()
        notifManager = NotificationManagerCompat.from(this)
        createNotificationChannel()
        startForegroundWithSummary()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START  -> handleStart(intent)
            ACTION_CANCEL -> handleCancel(intent)
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        executor.shutdownNow()
    }

    // ── Notification Channel ─────────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val chan = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Download progress notifications"
                setShowBadge(true)
            }
            val mgr = getSystemService(NotificationManager::class.java)
            mgr?.createNotificationChannel(chan)
        }
    }

    private fun startForegroundWithSummary() {
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("MovieVerse")
            .setContentText("Downloads running…")
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setOngoing(true)
            .setSilent(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(FOREGROUND_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(FOREGROUND_ID, notification)
        }
    }

    // ── Download Dispatch ─────────────────────────────────────────────────────

    private fun handleStart(intent: Intent) {
        val taskId   = intent.getStringExtra(EXTRA_TASK_ID) ?: return
        val url      = intent.getStringExtra(EXTRA_URL)     ?: return
        val filename = intent.getStringExtra(EXTRA_FILENAME) ?: "download.mp4"
        val title    = intent.getStringExtra(EXTRA_TITLE)   ?: "Downloading…"

        if (activeJobs.containsKey(taskId)) return // already running

        val job = DownloadJob(taskId = taskId, url = url, filename = filename, title = title)
        activeJobs[taskId] = job

        showProgressNotification(job, 0)
        DownloadBridge.updateProgress(taskId, 0L, 0L)

        executor.submit {
            runDownload(job)
        }
    }

    private fun handleCancel(intent: Intent) {
        val taskId = intent.getStringExtra(EXTRA_TASK_ID) ?: return
        activeJobs[taskId]?.cancelled = true
        activeJobs.remove(taskId)
        cancelNotification(taskId)
        checkStopSelf()
    }

    // ── Core Download Logic (With HTTP Range Resume & Automatic Retry) ────────

    private fun runDownload(job: DownloadJob) {
        var destUri: Uri? = null
        var totalBytes = -1L
        var writtenBytes = 0L
        var maxRetries = 4
        var attempt = 0
        var isSuccess = false

        val safeFilename = sanitizeFilename(job.filename)

        while (attempt < maxRetries && !job.cancelled && !isSuccess) {
            attempt++
            var conn: HttpURLConnection? = null
            var outputStream: OutputStream? = null

            try {
                conn = URL(job.url).openConnection() as HttpURLConnection
                conn.connectTimeout = 25_000
                conn.readTimeout    = 60_000
                conn.instanceFollowRedirects = true
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36")
                conn.setRequestProperty("Accept", "*/*")

                // If resuming, send HTTP Range header
                if (writtenBytes > 0) {
                    conn.setRequestProperty("Range", "bytes=$writtenBytes-")
                    Log.i(TAG, "Resuming download at byte $writtenBytes (attempt $attempt)")
                }

                conn.connect()
                val code = conn.responseCode

                // 200 = Full file, 206 = Partial content (resumed), 416 = Range satisfied / already complete
                if (code == 416 && writtenBytes > 0) {
                    isSuccess = true
                    break
                }
                if (code !in 200..299) {
                    throw IOException("HTTP error $code from upstream server")
                }

                // If starting fresh or server doesn't support range
                if (code == 200) {
                    totalBytes = conn.contentLengthLong
                    writtenBytes = 0L
                    val pair = openOutputFile(safeFilename, append = false)
                    destUri = pair.first
                    outputStream = pair.second
                } else if (code == 206) {
                    // Resumed
                    val contentRange = conn.getHeaderField("Content-Range")
                    if (contentRange != null && contentRange.contains("/")) {
                        val totalStr = contentRange.substringAfterLast("/")
                        totalBytes = totalStr.toLongOrNull() ?: totalBytes
                    }
                    val pair = openOutputFile(safeFilename, append = true, existingUri = destUri)
                    destUri = pair.first
                    outputStream = pair.second
                } else {
                    val pair = openOutputFile(safeFilename, append = writtenBytes > 0, existingUri = destUri)
                    destUri = pair.first
                    outputStream = pair.second
                }

                val buffer = ByteArray(128 * 1024) // 128 KB buffer
                val input  = BufferedInputStream(conn.inputStream, 256 * 1024)
                var lastNotifUpdate = System.currentTimeMillis()

                while (true) {
                    if (job.cancelled) {
                        cleanupFile(destUri)
                        return
                    }
                    val n = input.read(buffer)
                    if (n == -1) {
                        isSuccess = true
                        break
                    }
                    outputStream.write(buffer, 0, n)
                    writtenBytes += n

                    val pct = if (totalBytes > 0) ((writtenBytes * 100) / totalBytes).toInt() else -1

                    // Update UI and notification every ~800ms
                    val now = System.currentTimeMillis()
                    if (now - lastNotifUpdate > 800) {
                        lastNotifUpdate = now
                        job.progress = pct.coerceIn(0, 99)
                        updateProgressNotification(job, job.progress, writtenBytes, totalBytes)
                        broadcastProgress(job.taskId, writtenBytes, totalBytes)
                    }
                }

                outputStream.flush()

            } catch (e: Exception) {
                Log.w(TAG, "Download attempt $attempt failed for ${job.taskId}: ${e.message}")
                if (job.cancelled) {
                    cleanupFile(destUri)
                    return
                }
                if (attempt < maxRetries) {
                    try { Thread.sleep(2500L * attempt) } catch (_: Exception) {}
                }
            } finally {
                try { outputStream?.close() } catch (_: Exception) {}
                try { conn?.disconnect() } catch (_: Exception) {}
            }
        }

        if (isSuccess && !job.cancelled) {
            if (destUri != null) {
                markMediaStoreComplete(destUri)
            }
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && destUri != null) {
                sendBroadcast(Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE, destUri))
            }
            Log.i(TAG, "Download complete: ${job.filename} ($writtenBytes bytes)")
            broadcastComplete(job.taskId, destUri?.toString() ?: "")
            showCompleteNotification(job, destUri)
        } else if (!job.cancelled) {
            Log.e(TAG, "Download permanently failed for ${job.taskId} after $attempt attempts")
            broadcastError(job.taskId, "Download interrupted. Please check network.")
            showErrorNotification(job)
            cleanupFile(destUri)
        }

        activeJobs.remove(job.taskId)
        checkStopSelf()
    }

    // ── File Output (Scoped MediaStore / Direct File) ──────────────────────────

    private fun openOutputFile(
        filename: String,
        append: Boolean = false,
        existingUri: Uri? = null
    ): Pair<Uri?, OutputStream> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val resolver = contentResolver
            val uri: Uri
            if (append && existingUri != null) {
                uri = existingUri
            } else {
                val values = ContentValues().apply {
                    put(android.provider.MediaStore.Downloads.DISPLAY_NAME, filename)
                    put(android.provider.MediaStore.Downloads.MIME_TYPE, "video/mp4")
                    put(android.provider.MediaStore.Downloads.RELATIVE_PATH, "Download/movieverse")
                    put(android.provider.MediaStore.Downloads.IS_PENDING, 1)
                }
                uri = resolver.insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: throw IOException("MediaStore insert returned null")
            }
            val mode = if (append) "wa" else "w"
            val os  = resolver.openOutputStream(uri, mode)
                ?: throw IOException("Cannot open output stream for $uri")
            Pair(uri, os)
        } else {
            @Suppress("DEPRECATION")
            val dir = File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                "movieverse"
            )
            if (!dir.exists()) dir.mkdirs()
            val file = File(dir, filename)
            Pair(Uri.fromFile(file), FileOutputStream(file, append))
        }
    }

    private fun cleanupFile(uri: Uri?) {
        if (uri == null) return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                contentResolver.delete(uri, null, null)
            } else {
                val path = uri.path
                if (path != null) File(path).delete()
            }
        } catch (_: Exception) {}
    }

    private fun markMediaStoreComplete(uri: Uri) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                val values = ContentValues().apply {
                    put(android.provider.MediaStore.Downloads.IS_PENDING, 0)
                }
                contentResolver.update(uri, values, null, null)
            } catch (_: Exception) {}
        }
    }

    // ── Notifications ─────────────────────────────────────────────────────────

    private fun notifIdForTask(taskId: String): Int = NOTIF_ID_BASE + (taskId.hashCode() and 0x3FFF)

    private fun showProgressNotification(job: DownloadJob, pct: Int) {
        val n = buildProgressNotif(job, pct, -1L, -1L)
        notifManager?.notify(notifIdForTask(job.taskId), n)
    }

    private fun updateProgressNotification(job: DownloadJob, pct: Int, written: Long, total: Long) {
        val n = buildProgressNotif(job, pct, written, total)
        notifManager?.notify(notifIdForTask(job.taskId), n)

        val summary = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("MovieVerse — Downloading ${activeJobs.size} file(s)")
            .setContentText(formatMb(written) + (if (total > 0) " / " + formatMb(total) else ""))
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setOngoing(true)
            .setSilent(true)
            .build()
        notifManager?.notify(FOREGROUND_ID, summary)
    }

    private fun buildProgressNotif(job: DownloadJob, pct: Int, written: Long, total: Long): Notification {
        val cancelIntent = Intent(this, DownloadService::class.java).apply {
            action = ACTION_CANCEL
            putExtra(EXTRA_TASK_ID, job.taskId)
        }
        val cancelPending = PendingIntent.getService(
            this,
            notifIdForTask(job.taskId),
            cancelIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val subtext = if (total > 0) {
            "Downloading • ${formatMb(written)} / ${formatMb(total)}"
        } else if (written > 0) {
            "Downloading • ${formatMb(written)}"
        } else {
            "Downloading…"
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(job.title)
            .setContentText(subtext)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setProgress(100, pct.coerceIn(0, 100), pct < 0)
            .setOngoing(true)
            .setSilent(true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Cancel", cancelPending)
            .build()
    }

    private fun showCompleteNotification(job: DownloadJob, destUri: Uri?) {
        val openIntent = destUri?.let { uri ->
            Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "video/mp4")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
            }.let {
                PendingIntent.getActivity(
                    this,
                    notifIdForTask(job.taskId),
                    it,
                    PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
                )
            }
        }

        val n = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Download Complete 🎉")
            .setContentText("${job.title} is ready to watch offline.")
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setAutoCancel(true)
            .apply { if (openIntent != null) setContentIntent(openIntent) }
            .build()

        notifManager?.notify(notifIdForTask(job.taskId), n)
    }

    private fun showErrorNotification(job: DownloadJob) {
        val n = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Download failed")
            .setContentText(job.title)
            .setSmallIcon(android.R.drawable.stat_notify_error)
            .setAutoCancel(true)
            .build()
        notifManager?.notify(notifIdForTask(job.taskId), n)
    }

    private fun cancelNotification(taskId: String) {
        notifManager?.cancel(notifIdForTask(taskId))
    }

    // ── Broadcasts & Direct Bridge Events → JS ───────────────────────────────

    private fun broadcastProgress(taskId: String, written: Long, total: Long) {
        // 1. Direct in-process bridge (guaranteed, zero latency)
        DownloadBridge.updateProgress(taskId, written, total)

        // 2. Explicit broadcast with package name as fallback
        sendBroadcast(Intent(BROADCAST_PROGRESS).apply {
            setPackage(packageName)
            putExtra("task_id", taskId)
            putExtra("written", written)
            putExtra("total", total)
        })
    }

    private fun broadcastComplete(taskId: String, localUri: String) {
        DownloadBridge.complete(taskId, localUri)
        sendBroadcast(Intent(BROADCAST_COMPLETE).apply {
            setPackage(packageName)
            putExtra("task_id", taskId)
            putExtra("local_uri", localUri)
        })
    }

    private fun broadcastError(taskId: String, error: String) {
        DownloadBridge.error(taskId, error)
        sendBroadcast(Intent(BROADCAST_ERROR).apply {
            setPackage(packageName)
            putExtra("task_id", taskId)
            putExtra("error", error)
        })
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun checkStopSelf() {
        if (activeJobs.isEmpty()) {
            handler.postDelayed({
                if (activeJobs.isEmpty()) {
                    notifManager?.cancel(FOREGROUND_ID)
                    stopSelf()
                }
            }, 2500)
        }
    }

    private fun sanitizeFilename(name: String): String =
        name.replace(Regex("[^a-zA-Z0-9._\\-]"), "_").take(200)

    private fun formatMb(bytes: Long): String {
        if (bytes <= 0) return "0 MB"
        val mb = bytes / (1024.0 * 1024.0)
        return if (mb >= 1024) "${"%.2f".format(mb / 1024)} GB" else "${"%.1f".format(mb)} MB"
    }
}
