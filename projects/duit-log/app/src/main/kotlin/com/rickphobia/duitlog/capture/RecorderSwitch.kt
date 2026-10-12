package com.rickphobia.duitlog.capture

import android.content.Context
import androidx.core.content.edit
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * The debug setting behind the recorder. Off by default: Wallet notifications are captured into
 * the Ledger only. On, they are also recorded, and ⋮ shows the Recorder, so new wording (a Wallet
 * update, a notification the Reader can't read) can be collected as samples.
 */
class RecorderSwitch(
    context: Context,
) {
    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private val state = MutableStateFlow(prefs.getBoolean(RECORDER_ON, false))

    val on: StateFlow<Boolean> = state.asStateFlow()

    fun set(on: Boolean) {
        prefs.edit { putBoolean(RECORDER_ON, on) }
        state.value = on
    }

    private companion object {
        const val PREFS = "debug"
        const val RECORDER_ON = "recorder_on"
    }
}
