package com.rickphobia.gloss.card

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Gloss's own purple (the icon's), not the phone's wallpaper colours, so it looks the same on every phone.
private val Purple = Color(0xFF5B3A8C)
private val LightPurple = Color(0xFFCDB6F0)

/** Light or dark, following the phone's setting, so the card never flashes white at night. */
@Composable
fun GlossTheme(content: @Composable () -> Unit) {
    val colors =
        if (isSystemInDarkTheme()) {
            darkColorScheme(primary = LightPurple)
        } else {
            lightColorScheme(primary = Purple)
        }
    MaterialTheme(colorScheme = colors, content = content)
}
