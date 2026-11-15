package com.cinescope.guide

import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.ActivityInfo
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.webkit.*
import androidx.appcompat.app.AppCompatActivity
import com.cinescope.guide.databinding.ActivityMainBinding
import com.google.firebase.ktx.Firebase
import com.google.firebase.remoteconfig.ktx.remoteConfig

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var customVideoView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private var webChromeClientInstance: WebChromeClient? = null

    // ── The URL that actually loads ──────────────────────────────────────────
    private val appUrl: String
        get() {
            val prefs = getSharedPreferences("cinescope_prefs", MODE_PRIVATE)
            val customUrl = prefs.getString("custom_server_url", "") ?: ""
            if (customUrl.isNotBlank()) return customUrl

            val rc = Firebase.remoteConfig
            val url = rc.getString("app_url")
            return if (url.isNotBlank() && url != "https://www.themoviedb.org") url else "https://movieverse.click"
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Lock to 16:9 Landscape for Android TV / TV Box
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE

        // Immersive Sticky fullscreen mode for 10-foot TV experience
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        )

        setupWebView()
        binding.webView.loadUrl(appUrl)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        with(binding.webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            // Smart TV User-Agent to render 16:9 10-foot cinema UI with 0 ads
            userAgentString = "Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 TV Safari/537.36"
        }

        binding.webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                binding.progressBar.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                binding.progressBar.visibility = View.GONE
            }

            override fun onReceivedError(
                view: WebView?, request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    view?.loadUrl("file:///android_asset/error.html")
                }
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url?.toString() ?: return false
                if (request?.isForMainFrame == false) {
                    return false
                }
                if (url.startsWith("intent://") || url.startsWith("market://")) {
                    try {
                        val intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                        startActivity(intent)
                    } catch (e: Exception) { /* ignore */ }
                    return true
                }
                val appHost = Uri.parse(appUrl).host ?: ""
                if (appHost.isNotBlank() && !url.contains(appHost) && !url.startsWith("about:") && !url.startsWith("data:")) {
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    } catch (e: Exception) { /* ignore */ }
                    return true
                }
                return false
            }
        }

        binding.webView.isVerticalScrollBarEnabled = false
        binding.webView.isHorizontalScrollBarEnabled = false
        binding.webView.overScrollMode = View.OVER_SCROLL_IF_CONTENT_SCROLLS

        val chromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                binding.progressBar.progress = newProgress
            }

            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                if (customVideoView != null) {
                    onHideCustomView()
                    return
                }

                customVideoView = view
                customViewCallback = callback

                binding.customViewContainer.addView(view)
                binding.customViewContainer.visibility = View.VISIBLE
                binding.webView.visibility = View.GONE
                binding.progressBar.visibility = View.GONE

                window.decorView.systemUiVisibility = (
                    View.SYSTEM_UI_FLAG_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                )
            }

            override fun onHideCustomView() {
                if (customVideoView == null) return

                binding.customViewContainer.visibility = View.GONE
                binding.customViewContainer.removeView(customVideoView)
                customVideoView = null

                try {
                    customViewCallback?.onCustomViewHidden()
                } catch (e: Exception) { /* ignore */ }
                customViewCallback = null

                binding.webView.visibility = View.VISIBLE
            }
        }

        webChromeClientInstance = chromeClient
        binding.webView.webChromeClient = chromeClient
    }

    // Android TV Remote / D-Pad Navigation Support
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN) {
            when (event.keyCode) {
                KeyEvent.KEYCODE_BACK -> {
                    if (customVideoView != null) {
                        webChromeClientInstance?.onHideCustomView()
                        return true
                    }
                    if (binding.webView.canGoBack()) {
                        binding.webView.goBack()
                        return true
                    }
                }
            }
        }
        return super.dispatchKeyEvent(event)
    }

    override fun onDestroy() {
        binding.webView.destroy()
        super.onDestroy()
    }
}
