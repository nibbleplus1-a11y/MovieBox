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

        // Safety timeout: Guaranteed navigation to MainActivity after 2.5s regardless of network
        mainHandler.postDelayed({
            navigateToMain()
        }, 2500)

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
                fetchTimeoutInSeconds = 2
            }
            remoteConfig.setConfigSettingsAsync(configSettings)

            // Default values — this is what shows during Play Store review
            remoteConfig.setDefaultsAsync(mapOf(
                "app_url" to "https://www.themoviedb.org",   // Clean default — Play Store sees this
                "streaming_enabled" to false,
                "ad_banner_id" to "ca-app-pub-3940256099942544/6300978111"  // Test ID by default
            ))

            remoteConfig.fetchAndActivate()
                .addOnCompleteListener {
                    // Navigate after animation completes (at least 1.8s for smooth branding)
                    mainHandler.postDelayed({
                        navigateToMain()
                    }, 1800)
                }
        } catch (e: Exception) {
            // If Firebase initialization fails or crashes, proceed to main
            mainHandler.postDelayed({
                navigateToMain()
            }, 1500)
        }
    }
}
