package com.jubilee.os.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

/**
 * Light color scheme for JubileeOS
 * Faith-inspired colors: Deep Royal Blue, Warm Gold, Soft Lavender
 */
private val LightColorScheme = lightColorScheme(
    // Primary colors
    primary = PrimaryBlue,
    onPrimary = Color.White,
    primaryContainer = PrimaryBlueLight,
    onPrimaryContainer = Color.White,

    // Secondary colors
    secondary = SecondaryGold,
    onSecondary = Color.Black,
    secondaryContainer = SecondaryGoldLight,
    onSecondaryContainer = Color.Black,

    // Tertiary colors
    tertiary = AccentLavender,
    onTertiary = Color.White,
    tertiaryContainer = AccentLavenderLight,
    onTertiaryContainer = Color.Black,

    // Background and surface
    background = BackgroundCream,
    onBackground = NeutralGray900,
    surface = BackgroundWhite,
    onSurface = NeutralGray900,
    surfaceVariant = NeutralGray100,
    onSurfaceVariant = NeutralGray700,

    // Error colors
    error = ErrorRed,
    onError = Color.White,
    errorContainer = Color(0xFFFFDAD6),
    onErrorContainer = Color(0xFF410002),

    // Outline
    outline = NeutralGray400,
    outlineVariant = NeutralGray200,

    // Inverse colors
    inverseSurface = NeutralGray900,
    inverseOnSurface = NeutralGray100,
    inversePrimary = PrimaryBlueLight
)

/**
 * Dark color scheme for JubileeOS
 * Maintains faith-inspired aesthetic in dark mode with enhanced visibility
 */
private val DarkColorScheme = darkColorScheme(
    // Primary colors - Brighter blue for dark mode visibility
    primary = PrimaryBlueDarkMode,
    onPrimary = BackgroundDark,
    primaryContainer = PrimaryBlue,
    onPrimaryContainer = PrimaryBlueDarkMode,

    // Secondary colors - Vibrant gold for dark mode
    secondary = SecondaryGoldDarkMode,
    onSecondary = BackgroundDark,
    secondaryContainer = SecondaryGoldDark,
    onSecondaryContainer = SecondaryGoldDarkMode,

    // Tertiary colors - Bright lavender for dark mode
    tertiary = AccentLavenderDarkMode,
    onTertiary = BackgroundDark,
    tertiaryContainer = AccentLavenderDark,
    onTertiaryContainer = AccentLavenderDarkMode,

    // Background and surface - Deep dark with blue tint
    background = BackgroundDark,
    onBackground = Color(0xFFE8E8F0),
    surface = SurfaceDark,
    onSurface = Color(0xFFE8E8F0),
    surfaceVariant = SurfaceContainerDark,
    onSurfaceVariant = NeutralGray300,
    surfaceContainerLow = BackgroundDark,
    surfaceContainer = SurfaceContainerDark,
    surfaceContainerHigh = SurfaceContainerHighDark,

    // Error colors
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
    errorContainer = Color(0xFF93000A),
    onErrorContainer = Color(0xFFFFDAD6),

    // Outline - Subtle borders
    outline = NeutralGray600,
    outlineVariant = Color(0xFF35354A),

    // Inverse colors
    inverseSurface = NeutralGray100,
    inverseOnSurface = NeutralGray900,
    inversePrimary = PrimaryBlue
)

/**
 * JubileeOS Theme - A faith-focused Material 3 theme
 *
 * @param darkTheme Whether to use dark theme (defaults to system setting)
 * @param dynamicColor Whether to use dynamic color (Android 12+, defaults to false for consistent branding)
 * @param content The composable content to theme
 */
@Composable
fun JubileeOSTheme(
    darkTheme: Boolean = true, // Default to dark theme for JubileeOS
    dynamicColor: Boolean = false, // Disabled by default to maintain faith-inspired branding
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            // Dark status bar for immersive dark mode experience
            window.statusBarColor = BackgroundDark.toArgb()
            window.navigationBarColor = BackgroundDark.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
            WindowCompat.getInsetsController(window, view).isAppearanceLightNavigationBars = false
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = JubileeTypography,
        content = content
    )
}
