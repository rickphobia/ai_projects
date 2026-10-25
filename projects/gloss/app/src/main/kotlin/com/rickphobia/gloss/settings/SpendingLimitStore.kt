package com.rickphobia.gloss.settings

import android.content.Context
import androidx.core.content.edit

/** The Spending limit the owner set in Settings, or [defaultMicros] until they change it. */
class SpendingLimitStore(
    context: Context,
    private val defaultMicros: Long,
) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun limitMicros(): Long = prefs.getLong(LIMIT_MICROS, defaultMicros)

    fun save(limitMicros: Long) {
        prefs.edit { putLong(LIMIT_MICROS, limitMicros) }
    }

    private companion object {
        const val PREFS_NAME = "spending"
        const val LIMIT_MICROS = "limit_micros"
    }
}
