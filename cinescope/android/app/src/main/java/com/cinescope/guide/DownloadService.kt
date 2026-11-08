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
 * A proper Android Foreground Service that:
 * 1. Keeps downloading EVEN when the app is closed / swiped away
 * 2. Shows download progress in the status-bar notification tray
 * 3. Saves files to public Downloads/movieverse folder (accessible in Files app)
 * 4. Supports multiple parallel downloads
 * 5. Sends a React-Native-compatible broadcast on progress/complete so the
 *    JS layer can update its UI when the app is back in foreground.
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

    // ── Core Download Logic ───────────────────────────────────────────────────

    private fun runDownload(job: DownloadJob) {
        var conn: HttpURLConnection? = null
        var outputStream: OutputStream? = null
        var destUri: Uri? = null

        try {
            conn = URL(job.url).openConnection() as HttpURLConnection
            conn.connectTimeout = 20_000
            conn.readTimeout    = 60_000
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Android)")
            conn.connect()

            if (conn.responseCode !in 200..299) {
                throw IOException("Server returned ${conn.responseCode}")
            }

            val totalBytes = conn.contentLengthLong
            var writtenBytes = 0L

            // ── Save to public Downloads/movieverse ──────────────────────────
            val safeFilename = sanitizeFilename(job.filename)
            val pair = openOutputFile(safeFilename)
            destUri = pair.first
            outputStream = pair.second

            val buffer = ByteArray(128 * 1024) // 128 KB chunks
            val input  = BufferedInputStream(conn.inputStream, 256 * 1024)

            var lastNotifUpdate = System.currentTimeMillis()

            while (true) {
                if (job.cancelled) {
                    cleanupFile(destUri)
                    return
                }
                val n = input.read(buffer)
                if (n == -1) break
                outputStream.write(buffer, 0, n)
                writtenBytes += n

                val pct = if (totalBytes > 0) ((writtenBytes * 100) / totalBytes).toInt() else -1

                // throttle notification updates to ~1 per second
                val now = System.currentTimeMillis()
                if (now - lastNotifUpdate > 900) {
                    lastNotifUpdate = now
                    job.progress = pct.coerceIn(0, 99)
                    updateProgressNotification(job, job.progress, writtenBytes, totalBytes)
                    broadcastProgress(job.taskId, writtenBytes, totalBytes)
                }
            }

            outputStream.flush()

            // ── Notify media scanner ──────────────────────────────────────────
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && destUri != null) {
                sendBroadcast(Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE, destUri))
            }

            Log.i(TAG, "Download complete: ${job.filename}")
            broadcastComplete(job.taskId, destUri?.toString() ?: "")
            showCompleteNotification(job, destUri)

        } catch (e: Exception) {
            if (!job.cancelled) {
                Log.e(TAG, "Download error for ${job.taskId}: ${e.message}")
                broadcastError(job.taskId, e.message ?: "Download failed")
                showErrorNotification(job)
                cleanupFile(destUri)
            }
        } finally {
            try { outputStream?.close() } catch (_: Exception) {}
            try { conn?.disconnect() } catch (_: Exception) {}
            activeJobs.remove(job.taskId)
            checkStopSelf()
        }
    }

    // ── File Output ───────────────────────────────────────────────────────────

    /**
     * Open an output stream to Downloads/movieverse/<filename>.
     * On Android Q+ uses MediaStore; below Q uses direct File I/O.
     */
    private fun openOutputFile(filename: String): Pair<Uri?, OutputStream> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val resolver = contentResolver
            val values = android.content.ContentValues().apply {
                put(android.provider.MediaStore.Downloads.DISPLAY_NAME, filename)
                put(android.provider.MediaStore.Downloads.MIME_TYPE, "video/mp4")
                put(android.provider.MediaStore.Downloads.RELATIVE_PATH, "Download/movieverse")
                put(android.provider.MediaStore.Downloads.IS_PENDING, 1)
            }
            val uri = resolver.insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: throw IOException("MediaStore insert returned null")
            val os  = resolver.openOutputStream(uri)
                ?: throw IOException("Cannot open output stream for $uri")
            // Mark as not pending once done — done in broadcastComplete
            Pair(uri, os)
        } else {
            @Suppress("DEPRECATION")
            val dir = File(
                android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS),
                "movieverse"
            )
            if (!dir.exists()) dir.mkdirs()
            val file = File(dir, filename)
            Pair(Uri.fromFile(file), FileOutputStream(file))
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

    // ── MediaStore Pending Flag ───────────────────────────────────────────────

    private fun markMediaStoreComplete(uri: Uri) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                val values = android.content.ContentValues().apply {
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
        // Also update the foreground summary
        val summary = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("MovieVerse — Downloading ${activeJobs.size} file(s)")
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setOngoing(true)
            .setSilent(true)
            .build()
        notifManager?.notify(FOREGROUND_ID, summary)
    }

    private fun buildProgressNotif(job: DownloadJob, pct: Int, written: Long, total: Long): android.app.Notification {
        val sizeText = if (total > 0) " • ${formatMb(written)} / ${formatMb(total)}" else ""
        val cancelIntent = PendingIntent.getService(
            this, notifIdForTask(job.taskId),
            Intent(this, DownloadService::class.java).apply {
                action = ACTION_CANCEL
                putExtra(EXTRA_TASK_ID, job.taskId)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(job.title)
            .setContentText("Downloading$sizeText")
            .setSubText("$pct%")
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setProgress(100, pct.coerceIn(0, 100), pct <= 0 && total <= 0)
            .setOngoing(true)
            .setSilent(true)
            .addAction(android.R.drawable.ic_delete, "Cancel", cancelIntent)
            .build()
    }

    private fun showCompleteNotification(job: DownloadJob, uri: Uri?) {
        // Mark MediaStore as not-pending
        uri?.let { markMediaStoreComplete(it) }

        val openIntent = if (uri != null) {
            val viewIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "video/mp4")
                flags = Intent.FLAG_GRANT_READ_URI_PERMISSION
            }
            PendingIntent.getActivity(
                this, notifIdForTask(job.taskId),
                viewIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        } else null

        val n = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Download complete")
            .setContentText(job.title)
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

    // ── Broadcasts → JS ───────────────────────────────────────────────────────

    private fun broadcastProgress(taskId: String, written: Long, total: Long) {
        sendBroadcast(Intent(BROADCAST_PROGRESS).apply {
            putExtra("task_id", taskId)
            putExtra("written", written)
            putExtra("total", total)
        })
    }

    private fun broadcastComplete(taskId: String, localUri: String) {
        sendBroadcast(Intent(BROADCAST_COMPLETE).apply {
            putExtra("task_id", taskId)
            putExtra("local_uri", localUri)
        })
    }

    private fun broadcastError(taskId: String, error: String) {
        sendBroadcast(Intent(BROADCAST_ERROR).apply {
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
            }, 2000)
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
