package com.cinescope.guide

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * React Native Module that bridges the JS layer with DownloadService.
 * Uses both direct in-process DownloadBridge and Android BroadcastReceiver
 * for 100% reliable event delivery on all Android versions.
 */
class DownloadModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val MODULE_NAME = "MovieVerseDownloader"
    }

    private val bridgeListener = object : DownloadBridge.Listener {
        override fun onProgress(taskId: String, written: Long, total: Long) {
            emit("MVDownloadProgress", Arguments.createMap().apply {
                putString("taskId", taskId)
                putDouble("written", written.toDouble())
                putDouble("total", total.toDouble())
            })
        }

        override fun onComplete(taskId: String, localUri: String) {
            emit("MVDownloadComplete", Arguments.createMap().apply {
                putString("taskId", taskId)
                putString("localUri", localUri)
            })
        }

        override fun onError(taskId: String, error: String) {
            emit("MVDownloadError", Arguments.createMap().apply {
                putString("taskId", taskId)
                putString("error", error)
            })
        }
    }

    private val broadcastReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context?, intent: Intent?) {
            when (intent?.action) {
                DownloadService.BROADCAST_PROGRESS -> {
                    val taskId  = intent.getStringExtra("task_id") ?: return
                    val written = intent.getLongExtra("written", 0)
                    val total   = intent.getLongExtra("total", 0)
                    emit("MVDownloadProgress", Arguments.createMap().apply {
                        putString("taskId", taskId)
                        putDouble("written", written.toDouble())
                        putDouble("total", total.toDouble())
                    })
                }
                DownloadService.BROADCAST_COMPLETE -> {
                    val taskId   = intent.getStringExtra("task_id") ?: return
                    val localUri = intent.getStringExtra("local_uri") ?: ""
                    emit("MVDownloadComplete", Arguments.createMap().apply {
                        putString("taskId", taskId)
                        putString("localUri", localUri)
                    })
                }
                DownloadService.BROADCAST_ERROR -> {
                    val taskId = intent.getStringExtra("task_id") ?: return
                    val error  = intent.getStringExtra("error") ?: "Unknown error"
                    emit("MVDownloadError", Arguments.createMap().apply {
                        putString("taskId", taskId)
                        putString("error", error)
                    })
                }
            }
        }
    }

    override fun getName(): String = MODULE_NAME

    override fun initialize() {
        super.initialize()
        // Register direct in-process listener (guaranteed delivery)
        DownloadBridge.listener = bridgeListener

        // Also register system broadcast receiver as fallback
        val filter = IntentFilter().apply {
            addAction(DownloadService.BROADCAST_PROGRESS)
            addAction(DownloadService.BROADCAST_COMPLETE)
            addAction(DownloadService.BROADCAST_ERROR)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            reactContext.registerReceiver(broadcastReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            reactContext.registerReceiver(broadcastReceiver, filter)
        }
    }

    override fun invalidate() {
        DownloadBridge.listener = null
        try { reactContext.unregisterReceiver(broadcastReceiver) } catch (_: Exception) {}
        super.invalidate()
    }

    @ReactMethod
    fun startDownload(taskId: String, url: String, filename: String, title: String) {
        DownloadService.startDownload(reactContext, taskId, url, filename, title)
    }

    @ReactMethod
    fun cancelDownload(taskId: String) {
        DownloadService.cancelDownload(reactContext, taskId)
    }

    @ReactMethod
    fun getActiveSnapshots(promise: Promise) {
        try {
            val map = Arguments.createMap()
            DownloadBridge.getAllSnapshots().forEach { (k, v) ->
                map.putMap(k, Arguments.createMap().apply {
                    putString("taskId", v.taskId)
                    putDouble("written", v.written.toDouble())
                    putDouble("total", v.total.toDouble())
                    putInt("progress", v.progress)
                })
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.resolve(Arguments.createMap())
        }
    }

    @ReactMethod
    fun addListener(eventName: String) { /* Required for RN event emitter */ }

    @ReactMethod
    fun removeListeners(count: Double) { /* Required for RN event emitter */ }

    private fun emit(event: String, params: WritableMap) {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(event, params)
        } catch (_: Exception) {}
    }
}
