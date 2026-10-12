package com.rickphobia.duitlog

import android.app.Application
import com.rickphobia.duitlog.capture.RecordingStore
import com.rickphobia.duitlog.logging.AppLog
import com.rickphobia.duitlog.storage.PhoneStorageCheck
import java.io.File

/**
 * Starts what every part of the app needs, once per process: the log (so a notification listener
 * started without the activity logs too) and the storage check. Also holds the one recorder store
 * that the listener and the screens share.
 */
class DuitLogApplication : Application() {
    val recordings by lazy {
        RecordingStore(File(filesDir, RECORDINGS_DIR), MAX_RECORDINGS_BYTES).also { store ->
            if (store.damagedLines > 0) AppLog.w("skipped ${store.damagedLines} damaged lines in the recordings")
        }
    }

    override fun onCreate() {
        super.onCreate()
        AppLog.start(File(filesDir, LOG_DIR))
        AppLog.i("started ${BuildConfig.VERSION_NAME} (build ${BuildConfig.VERSION_CODE})")
        PhoneStorageCheck.run(this)
    }

    companion object {
        const val LOG_DIR = "logs"

        // Must match the backup rules in res/xml, which leave the recordings out.
        const val RECORDINGS_DIR = "recordings"

        // Thousands of notifications: far more than the week of recording milestone 1 needs.
        private const val MAX_RECORDINGS_BYTES = 5_000_000L
    }
}
