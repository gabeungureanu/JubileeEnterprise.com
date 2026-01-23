package com.jubilee.os

import android.graphics.Color
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.core.view.WindowCompat
import com.jubilee.os.ui.launcher.LauncherScreen
import com.jubilee.os.ui.theme.JubileeOSTheme
import dagger.hilt.android.AndroidEntryPoint

/**
 * MainActivity - The main launcher activity for JubileeOS
 *
 * This activity serves as the home screen replacement,
 * providing a faith-focused interface for the device.
 * Fully branded with JubileeTablet.com identity.
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Set black background immediately to prevent any white flash
        window.setBackgroundDrawableResource(android.R.color.black)
        window.decorView.setBackgroundColor(Color.BLACK)
        window.statusBarColor = Color.BLACK
        window.navigationBarColor = Color.BLACK

        // Make status bar icons light (for dark background)
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }

        enableEdgeToEdge()

        setContent {
            JubileeOSTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    LauncherScreen()
                }
            }
        }
    }

    /**
     * Override back press to prevent exiting the launcher
     * (users should stay on home screen)
     */
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // Do nothing - this is a launcher, back should not exit
        // Users can still use the home button to return
    }
}
