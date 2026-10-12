package com.rickphobia.duitlog.screens

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// The app's own green, not the phone's wallpaper colours, so it looks the same on every phone.
private val Green = Color(0xFF1B7F5A)
private val LightGreen = Color(0xFF7FD8B0)

/** Light or dark, following the phone's setting. */
@Composable
fun DuitLogTheme(content: @Composable () -> Unit) {
    val colors =
        if (isSystemInDarkTheme()) {
            darkColorScheme(primary = LightGreen)
        } else {
            lightColorScheme(primary = Green)
        }
    MaterialTheme(colorScheme = colors, content = content)
}
