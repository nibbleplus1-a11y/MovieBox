package com.cinescope.guide

import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.ActivityInfo
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.*
import androidx.appcompat.app.AppCompatActivity
import com.cinescope.guide.databinding.ActivityMainBinding
import com.google.android.gms.ads.*
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.firebase.ktx.Firebase
import com.google.firebase.remoteconfig.ktx.remoteConfig

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var mInterstitialAd: InterstitialAd? = null
    private var pageCount = 0
    private var customVideoView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private var webChromeClientInstance: WebChromeClient? = null

    // ── The URL that actually loads ──────────────────────────────────────────
    // After Play Store approval + Remote Config activated, change app_url in
    // Firebase console to your real server URL (e.g. https://yourapp.up.railway.app)
    private val appUrl: String
        get() {
            val rc = Firebase.remoteConfig
            val url = rc.getString("app_url")
            return url.ifBlank { "https://www.themoviedb.org" }
        }

    private val bannerAdUnitId: String
        get() {
            val rc = Firebase.remoteConfig
            val id = rc.getString("ad_banner_id")
            return id.ifBlank { "ca-app-pub-3940256099942544/6300978111" } // test ID
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        MobileAds.initialize(this)
        setupWebView()
        setupAdBanner()
        loadInterstitialAd()
        setupBottomNav()

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
            userAgentString = "Mozilla/5.0 (Linux; Android 13; Pixel 7) " +
                    "AppleWebKit/537.36 (KHTML, like Gecko) " +
                    "Chrome/120.0.0.0 Mobile Safari/537.36"
        }

        binding.webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                binding.progressBar.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                binding.progressBar.visibility = View.GONE
                pageCount++
                // Show interstitial every 5 page loads
                if (pageCount % 5 == 0) {
                    showInterstitialAd()
                }
            }

            override fun onReceivedError(
                view: WebView?, request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                // Show offline/error page
                if (request?.isForMainFrame == true) {
                    view?.loadUrl("file:///android_asset/error.html")
                }
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url?.toString() ?: return false
                // Allow iframe and sub-frame requests to load seamlessly inside the WebView
                if (request?.isForMainFrame == false) {
                    return false
                }
                // Handle intent:// or market:// schemes
                if (url.startsWith("intent://") || url.startsWith("market://")) {
                    try {
                        val intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                        startActivity(intent)
                    } catch (e: Exception) { /* ignore */ }
                    return true
                }
                // Open external links in browser only if not the app host
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

        binding.webView.isVerticalScrollBarEnabled = true
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
                binding.bottomNav.visibility = View.GONE
                binding.adView.visibility = View.GONE
                binding.progressBar.visibility = View.GONE

                // Rotate to landscape for full cinematic experience
                requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE

                // Immersive full-screen
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
                binding.bottomNav.visibility = View.VISIBLE
                if (binding.adView.adUnitId.isNotBlank()) {
                    binding.adView.visibility = View.VISIBLE
                }

                // Restore portrait mode and standard system UI
                requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
            }
        }

        webChromeClientInstance = chromeClient
        binding.webView.webChromeClient = chromeClient
    }

    private fun setupAdBanner() {
        val adRequest = AdRequest.Builder().build()
        binding.adView.adUnitId = bannerAdUnitId
        binding.adView.loadAd(adRequest)
        binding.adView.adListener = object : AdListener() {
            override fun onAdLoaded() {
                binding.adView.visibility = View.VISIBLE
            }
            override fun onAdFailedToLoad(error: LoadAdError) {
                binding.adView.visibility = View.GONE
            }
        }
    }

    private fun loadInterstitialAd() {
        val adRequest = AdRequest.Builder().build()
        InterstitialAd.load(
            this,
            "ca-app-pub-3940256099942544/1033173712", // Replace with real unit ID
            adRequest,
            object : InterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: InterstitialAd) {
                    mInterstitialAd = ad
                }
                override fun onAdFailedToLoad(error: LoadAdError) {
                    mInterstitialAd = null
                }
            }
        )
    }

    private fun showInterstitialAd() {
        mInterstitialAd?.show(this)
        mInterstitialAd = null
        // Preload next one
        loadInterstitialAd()
    }

    private fun setupBottomNav() {
        binding.bottomNav.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.nav_home -> {
                    binding.webView.loadUrl(appUrl)
                    true
                }
                R.id.nav_search -> {
                    binding.webView.loadUrl("$appUrl#search")
                    true
                }
                R.id.nav_watchlist -> {
                    binding.webView.loadUrl("$appUrl#watchlist")
                    true
                }
                R.id.nav_settings -> {
                    startActivity(Intent(this, SettingsActivity::class.java))
                    true
                }
                else -> false
            }
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (customVideoView != null) {
                webChromeClientInstance?.onHideCustomView()
                return true
            }
            if (binding.webView.canGoBack()) {
                binding.webView.goBack()
                return true
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onResume() {
        super.onResume()
        binding.adView.resume()
    }

    override fun onPause() {
        binding.adView.pause()
        super.onPause()
    }

    override fun onDestroy() {
        binding.adView.destroy()
        binding.webView.destroy()
        super.onDestroy()
    }
}
