package com.rickphobia.duitlog.onboarding

import android.content.Context
import androidx.core.content.edit

/** Remembers whether the notification access guide has been seen, so it shows only on first run. */
class FirstRun(
    context: Context,
) {
    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    val guideSeen: Boolean get() = prefs.getBoolean(GUIDE_SEEN, false)

    fun markGuideSeen() = prefs.edit { putBoolean(GUIDE_SEEN, true) }

    private companion object {
        const val PREFS = "first_run"
        const val GUIDE_SEEN = "guide_seen"
    }
}
