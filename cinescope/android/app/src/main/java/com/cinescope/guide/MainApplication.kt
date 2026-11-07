package com.cinescope.guide

import android.app.Application
import android.content.res.Configuration
import android.util.Log

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.soloader.SoLoader

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

import java.io.PrintWriter
import java.io.StringWriter
import java.net.HttpURLConnection
import java.net.URL

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        }
    )
  }

  override fun onCreate() {
    super.onCreate()

    // 1. Install crash reporter that captures and posts any startup crash
    val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
      try {
        val sw = StringWriter()
        throwable.printStackTrace(PrintWriter(sw))
        val stackTrace = sw.toString()
        Log.e("MovieVerse", "FATAL CRASH on thread ${thread.name}: $stackTrace")

        val reportThread = Thread {
          try {
            val url = URL("https://movieverse.click/api/report-crash")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "text/plain")
            conn.connectTimeout = 3000
            conn.readTimeout = 3000
            val body = "Thread: ${thread.name}\nException: ${throwable.javaClass.name}\nMessage: ${throwable.message}\n\n$stackTrace"
            conn.outputStream.use { os ->
              os.write(body.toByteArray(Charsets.UTF_8))
            }
            conn.responseCode
          } catch (_: Exception) {}
        }
        reportThread.start()
        reportThread.join(2500)
      } catch (_: Exception) {}
      defaultHandler?.uncaughtException(thread, throwable)
    }

    // 2. Initialize SoLoader before loading New Architecture C++ libraries
    SoLoader.init(this, false)

    // 3. Load React Native New Architecture feature flags, bridgeless mode & native libraries
    DefaultNewArchitectureEntryPoint.load()

    // 3. Dispatch application creation to Expo modules
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
