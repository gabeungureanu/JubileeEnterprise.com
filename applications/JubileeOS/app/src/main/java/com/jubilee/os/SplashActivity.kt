package com.jubilee.os

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.jubilee.os.ui.theme.JubileeCyan
import com.jubilee.os.ui.theme.JubileeGold
import com.jubilee.os.ui.theme.JubileeBlack
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.delay

/**
 * SplashActivity - JubileeTablet.com branded startup screen
 *
 * IMPORTANT: This activity does NOT use AndroidX SplashScreen API.
 * Instead, it relies on the native Android 12+ splash screen attributes
 * defined in values-v31/themes.xml to control the system splash,
 * then immediately shows our custom Compose UI.
 *
 * This approach completely eliminates any Google/Pixel branding.
 */
@SuppressLint("CustomSplashScreen")
@AndroidEntryPoint
class SplashActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        // Set window to black BEFORE super.onCreate() to prevent any flash
        window.setBackgroundDrawableResource(android.R.color.black)

        super.onCreate(savedInstanceState)

        // Make the window completely black immediately
        window.decorView.setBackgroundColor(android.graphics.Color.BLACK)
        window.statusBarColor = android.graphics.Color.BLACK
        window.navigationBarColor = android.graphics.Color.BLACK

        // Ensure status bar icons are light (for dark background)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }

        // Add flags to ensure black background during any transition
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS)
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION)

        setContent {
            JubileeSplashScreen(
                onSplashComplete = {
                    startActivity(Intent(this@SplashActivity, MainActivity::class.java))
                    finish()
                    // No animation for seamless transition
                    @Suppress("DEPRECATION")
                    overridePendingTransition(0, 0)
                }
            )
        }
    }
}

@Composable
fun JubileeSplashScreen(onSplashComplete: () -> Unit) {
    var startAnimation by remember { mutableStateOf(false) }
    var progress by remember { mutableFloatStateOf(0f) }

    val alphaAnim by animateFloatAsState(
        targetValue = if (startAnimation) 1f else 0f,
        animationSpec = tween(durationMillis = 500),
        label = "alpha"
    )

    LaunchedEffect(key1 = true) {
        startAnimation = true
        // Animate progress bar over 2 seconds
        val totalDuration = 2000L
        val steps = 100
        val stepDelay = totalDuration / steps
        for (i in 1..steps) {
            delay(stepDelay)
            progress = i / steps.toFloat()
        }
        onSplashComplete()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(JubileeBlack),
        contentAlignment = Alignment.Center
    ) {
        // Main content - vertically and horizontally centered
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.alpha(alphaAnim)
        ) {
            // Avatar image with cyan ring - matches screenshot exactly
            Box(
                modifier = Modifier
                    .size(140.dp)
                    .clip(CircleShape)
                    .border(
                        width = 4.dp,
                        color = JubileeCyan,
                        shape = CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Image(
                    painter = painterResource(id = R.drawable.jubilee_avatar),
                    contentDescription = "Jubilee Avatar",
                    modifier = Modifier
                        .size(132.dp)
                        .clip(CircleShape),
                    contentScale = ContentScale.Crop
                )
            }

            Spacer(modifier = Modifier.height(32.dp))

            // JubileeTablet.com branding - exact match to screenshot
            Row {
                Text(
                    text = "Jubilee",
                    fontSize = 38.sp,
                    fontWeight = FontWeight.Bold,
                    color = JubileeCyan,
                    letterSpacing = 0.sp
                )
                Text(
                    text = "Tablet",
                    fontSize = 38.sp,
                    fontWeight = FontWeight.Bold,
                    color = JubileeGold,
                    letterSpacing = 0.sp
                )
                Text(
                    text = ".com",
                    fontSize = 38.sp,
                    fontWeight = FontWeight.Bold,
                    color = JubileeGold,
                    letterSpacing = 0.sp
                )
            }

            Spacer(modifier = Modifier.height(48.dp))

            // Progress section - below the branding
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(horizontal = 48.dp)
            ) {
                // Linear progress bar - matches screenshot
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier
                        .fillMaxWidth(0.6f)
                        .height(6.dp)
                        .clip(RoundedCornerShape(3.dp)),
                    color = JubileeGold,
                    trackColor = Color.Gray.copy(alpha = 0.3f)
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Loading text - matches screenshot
                Text(
                    text = "Jubilee Bible is Starting...",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Normal,
                    color = Color.White.copy(alpha = 0.7f),
                    letterSpacing = 0.5.sp
                )
            }
        }
    }
}
