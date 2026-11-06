package com.cinescope.guide

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.animation.AnimationUtils
import androidx.appcompat.app.AppCompatActivity
import com.cinescope.guide.databinding.ActivitySplashBinding
import com.google.firebase.ktx.Firebase
import com.google.firebase.remoteconfig.ktx.remoteConfig
import com.google.firebase.remoteconfig.ktx.remoteConfigSettings

class SplashActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySplashBinding
    private var hasNavigated = false
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySplashBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Animate logo
        val fadeIn = AnimationUtils.loadAnimation(this, R.anim.fade_in)
        val slideUp = AnimationUtils.loadAnimation(this, R.anim.slide_up)
        binding.ivLogo.startAnimation(fadeIn)
        binding.tvAppName.startAnimation(slideUp)
        binding.tvTagline.startAnimation(slideUp)

        // Safety timeout: Guaranteed navigation to MainActivity after 1.0s regardless of network
        mainHandler.postDelayed({
            navigateToMain()
        }, 1000)

        // Fetch Firebase Remote Config (controls which URL loads)
        fetchRemoteConfig()
    }

    private fun navigateToMain() {
        if (hasNavigated) return
        hasNavigated = true
        mainHandler.removeCallbacksAndMessages(null)
        startActivity(Intent(this, MainActivity::class.java))
        overridePendingTransition(R.anim.fade_in, R.anim.fade_out)
        finish()
    }

    private fun fetchRemoteConfig() {
        try {
            val remoteConfig = Firebase.remoteConfig
            val configSettings = remoteConfigSettings {
                minimumFetchIntervalInSeconds = 3600
                fetchTimeoutInSeconds = 1
            }
            remoteConfig.setConfigSettingsAsync(configSettings)

            // Default values — points to the live Oracle Cloud server
            remoteConfig.setDefaultsAsync(mapOf(
                "app_url" to "https://movieverse.click",
                "streaming_enabled" to true,
                "ad_banner_id" to "ca-app-pub-3940256099942544/6300978111"  // Test ID by default
            ))

            remoteConfig.fetchAndActivate()
                .addOnCompleteListener {
                    // Navigate quickly after fast branding fade (600ms)
                    mainHandler.postDelayed({
                        navigateToMain()
                    }, 600)
                }
        } catch (e: Exception) {
            // If Firebase initialization fails or crashes, proceed to main immediately
            mainHandler.postDelayed({
                navigateToMain()
            }, 500)
        }
    }
}
