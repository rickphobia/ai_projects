package com.rickphobia.ricknotes.settings

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.rickphobia.ricknotes.core.settings.InvalidSettingException
import com.rickphobia.ricknotes.core.settings.SettingsLoader
import com.rickphobia.ricknotes.core.settings.SettingsSource
import com.rickphobia.ricknotes.core.settings.SettingsStore
import com.rickphobia.ricknotes.core.touch.FingerGestures
import com.rickphobia.ricknotes.logging.AppLog

/** Finger erase and the tap gestures as the screens see them: loaded once, saved on every change. */
class FingerGesturesSetting<S>(
    private val settings: S,
) where S : SettingsSource, S : SettingsStore {
    var gestures by mutableStateOf(load())
        private set

    fun change(gestures: FingerGestures) {
        SettingsLoader.saveFingerGestures(settings, gestures)
        AppLog.i("finger gestures: $gestures")
        this.gestures = gestures
    }

    // A broken stored switch mustn't keep the student from writing: every gesture goes back to off.
    private fun load(): FingerGestures =
        try {
            SettingsLoader.loadFingerGestures(settings)
        } catch (e: InvalidSettingException) {
            AppLog.w("stored finger gestures unusable, turning them off: ${e.message}")
            FingerGestures()
        }
}
