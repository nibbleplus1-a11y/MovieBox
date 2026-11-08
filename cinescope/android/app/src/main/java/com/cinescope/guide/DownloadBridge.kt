package com.cinescope.guide

/**
 * Direct in-process bridge between DownloadService (background service)
 * and DownloadModule (React Native native module).
 *
 * Guarantees zero dropped progress updates on Android 13/14+ without
 * relying on Android broadcast intents which are subject to RECEIVER_NOT_EXPORTED
 * package filtering restrictions.
 */
object DownloadBridge {

    interface Listener {
        fun onProgress(taskId: String, written: Long, total: Long)
        fun onComplete(taskId: String, localUri: String)
        fun onError(taskId: String, error: String)
    }

    @Volatile
    var listener: Listener? = null

    // In-memory snapshot of active downloads so newly mounted JS screens immediately get latest progress
    data class ProgressSnapshot(
        val taskId: String,
        val written: Long,
        val total: Long,
        val progress: Int,
        val isDone: Boolean = false
    )

    private val snapshots = java.util.concurrent.ConcurrentHashMap<String, ProgressSnapshot>()

    fun updateProgress(taskId: String, written: Long, total: Long) {
        val pct = if (total > 0) ((written * 100) / total).toInt().coerceIn(0, 99) else 0
        snapshots[taskId] = ProgressSnapshot(taskId, written, total, pct)
        try {
            listener?.onProgress(taskId, written, total)
        } catch (_: Exception) {}
    }

    fun complete(taskId: String, localUri: String) {
        snapshots.remove(taskId)
        try {
            listener?.onComplete(taskId, localUri)
        } catch (_: Exception) {}
    }

    fun error(taskId: String, errorMsg: String) {
        snapshots.remove(taskId)
        try {
            listener?.onError(taskId, errorMsg)
        } catch (_: Exception) {}
    }

    fun getSnapshot(taskId: String): ProgressSnapshot? = snapshots[taskId]

    fun getAllSnapshots(): Map<String, ProgressSnapshot> = snapshots.toMap()
}
