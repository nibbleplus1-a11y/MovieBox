package com.movieverse.tv.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.ColorScheme
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Typography
import androidx.tv.material3.darkColorScheme

/**
 * Single source of truth for all CineScope / MovieVerse TV design tokens.
 * Re-skinning or rebranding only requires editing this file.
 */
object TvTokens {
    const val APP_NAME = "MovieVerse TV"

    // ── Palette (Netflix / Prime near-black cinema target) ───────────────────
    val Background = Color(0xFF0B0B0B)
    val Surface = Color(0xFF14161F)
    val SurfaceVariant = Color(0xFF1E212D)
    val CardBackground = Color(0xFF161822)

    // Primary Accent Color (can be swapped to Brand Blue, Amber, etc.)
    val Accent = Color(0xFFFF2E55)
    val AccentGlow = Color(0x66FF2E55)

    // Text Colors
    val TextPrimary = Color(0xFFFFFFFF)
    val TextSecondary = Color(0xFF94A3B8)
    val TextMuted = Color(0xFF64748B)

    // Focus & Selection
    val FocusBorder = Color(0xFFFFFFFF)
    val FocusBorderWidth = 3.dp
    const val FocusedScale = 1.12f

    // 10-Foot Overscan Safe Area Padding (TV Standard)
    val HorizontalSafePadding: Dp = 48.dp
    val VerticalSafePadding: Dp = 27.dp

    // Left Navigation Rail
    val NavRailCollapsedWidth: Dp = 68.dp
    val NavRailExpandedWidth: Dp = 220.dp
}

data class TvDimensions(
    val horizontalSafePadding: Dp = TvTokens.HorizontalSafePadding,
    val verticalSafePadding: Dp = TvTokens.VerticalSafePadding,
    val navRailCollapsedWidth: Dp = TvTokens.NavRailCollapsedWidth,
    val navRailExpandedWidth: Dp = TvTokens.NavRailExpandedWidth,
    val cardCornerRadius: Dp = 10.dp,
    val focusBorderWidth: Dp = TvTokens.FocusBorderWidth,
)

val LocalTvDimensions = staticCompositionLocalOf { TvDimensions() }

val TvColorScheme: ColorScheme = darkColorScheme(
    primary = TvTokens.Accent,
    onPrimary = Color.White,
    primaryContainer = TvTokens.SurfaceVariant,
    onPrimaryContainer = Color.White,
    secondary = TvTokens.TextSecondary,
    onSecondary = Color.White,
    background = TvTokens.Background,
    onBackground = TvTokens.TextPrimary,
    surface = TvTokens.Surface,
    onSurface = TvTokens.TextPrimary,
    surfaceVariant = TvTokens.SurfaceVariant,
    onSurfaceVariant = TvTokens.TextSecondary,
    border = TvTokens.FocusBorder
)

val TvTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Bold,
        fontSize = 44.sp,
        lineHeight = 52.sp,
        color = TvTokens.TextPrimary
    ),
    displayMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Bold,
        fontSize = 36.sp,
        lineHeight = 44.sp,
        color = TvTokens.TextPrimary
    ),
    headlineLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Bold,
        fontSize = 28.sp,
        lineHeight = 36.sp,
        color = TvTokens.TextPrimary
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.SemiBold,
        fontSize = 24.sp,
        lineHeight = 32.sp,
        color = TvTokens.TextPrimary
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 20.sp,
        lineHeight = 28.sp,
        color = TvTokens.TextPrimary
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 18.sp,
        lineHeight = 24.sp,
        color = TvTokens.TextSecondary
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.SemiBold,
        fontSize = 16.sp,
        lineHeight = 22.sp,
        color = TvTokens.TextPrimary
    )
)

@Composable
fun TvTheme(
    content: @Composable () -> Unit
) {
    CompositionLocalProvider(
        LocalTvDimensions provides TvDimensions()
    ) {
        MaterialTheme(
            colorScheme = TvColorScheme,
            typography = TvTypography,
            content = content
        )
    }
}

object TvThemeTokens {
    val dimensions: TvDimensions
        @Composable
        @ReadOnlyComposable
        get() = LocalTvDimensions.current
}
