package com.cinescope.guide

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.cinescope.guide.databinding.ActivitySettingsBinding
import com.google.firebase.ktx.Firebase
import com.google.firebase.remoteconfig.ktx.remoteConfig

class SettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySettingsBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        supportActionBar?.apply {
            title = "Settings"
            setDisplayHomeAsUpEnabled(true)
        }

        // Show current server URL (from remote config)
        val currentUrl = Firebase.remoteConfig.getString("app_url")
        binding.tvCurrentServer.text = if (currentUrl.isBlank())
            "Default (TMDB)" else currentUrl

        binding.tvVersion.text = "CineScope v${BuildConfig.VERSION_NAME}"
        binding.tvAbout.text = "CineScope is your personal movie guide. " +
                "Discover trending films, explore titles, and keep track of what to watch next."

        binding.btnClearCache.setOnClickListener {
            Toast.makeText(this, "Cache cleared", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onSupportNavigateUp(): Boolean {
        onBackPressedDispatcher.onBackPressed()
        return true
    }
}
