package com.rickphobia.gloss

import android.app.Application
import android.util.Log
import com.rickphobia.gloss.ai.AnthropicClient
import com.rickphobia.gloss.core.Gloss
import com.rickphobia.gloss.core.lookup.SqlLookupStore
import com.rickphobia.gloss.logging.RollingLog
import com.rickphobia.gloss.settings.ApiKeyStore
import com.rickphobia.gloss.settings.PhoneSettings
import com.rickphobia.gloss.storage.PhoneDatabase
import java.io.File
import java.time.Clock

/** Builds the app's parts once and hands them to the screens. */
class GlossApplication : Application() {
    lateinit var log: RollingLog
        private set
    lateinit var apiKeys: ApiKeyStore
        private set
    lateinit var anthropic: AnthropicClient
        private set
    lateinit var gloss: Gloss
        private set

    override fun onCreate() {
        super.onCreate()
        log = RollingLog(File(filesDir, "logs"), Clock.systemUTC(), echo = ::toLogcat)
        logCrashes(log)
        apiKeys = ApiKeyStore(this, log)
        anthropic = AnthropicClient(PhoneSettings.anthropic, apiKeys::read, log)
        val lookups = SqlLookupStore(PhoneDatabase.create(this))
        gloss = Gloss(anthropic, lookups, Clock.systemDefaultZone(), PhoneSettings)
        log.info("$packageName ${packageManager.getPackageInfo(packageName, 0).versionName} started")
    }

    /**
     * Puts a crash in the shared log before Android's own handler ends the app. Only the exception's
     * type and where it was thrown: its message could quote a Selection or an answer.
     */
    private fun logCrashes(log: RollingLog) {
        val androidHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            try {
                val frames = error.stackTrace.joinToString("\n") { "    at $it" }
                log.error("crash on ${thread.name}: ${error.javaClass.name}\n$frames")
            } finally {
                androidHandler?.uncaughtException(thread, error)
            }
        }
    }

    private fun toLogcat(
        level: RollingLog.Level,
        message: String,
    ) {
        when (level) {
            RollingLog.Level.INFO -> Log.i(LOG_TAG, message)
            RollingLog.Level.WARNING -> Log.w(LOG_TAG, message)
            RollingLog.Level.ERROR -> Log.e(LOG_TAG, message)
        }
    }

    private companion object {
        const val LOG_TAG = "Gloss"
    }
}
