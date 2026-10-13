package com.rickphobia.duitlog

import android.app.Application
import com.rickphobia.duitlog.capture.RecorderSwitch
import com.rickphobia.duitlog.capture.RecordingStore
import com.rickphobia.duitlog.core.ledger.Ledger
import com.rickphobia.duitlog.logging.AppLog
import com.rickphobia.duitlog.storage.PhoneClock
import com.rickphobia.duitlog.storage.PhoneDatabase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.io.File

/**
 * Starts what every part of the app needs, once per process: the log (so a notification listener
 * started without the activity logs too), the Ledger, and the recorder's store and switch, which
 * the listener and the screens share.
 */
class DuitLogApplication : Application() {
    val ledger: Ledger by lazy { Ledger(PhoneDatabase.create(this), PhoneClock()) }

    private val changeCount = MutableStateFlow(0)

    /** Counts the listener's changes to the Ledger, so an open screen reads it again. */
    val ledgerChanges: StateFlow<Int> = changeCount.asStateFlow()

    fun ledgerChanged() = changeCount.update { it + 1 }

    val recorderSwitch by lazy { RecorderSwitch(this) }

    val recordings by lazy {
        RecordingStore(File(filesDir, RECORDINGS_DIR), MAX_RECORDINGS_BYTES).also { store ->
            if (store.damagedLines > 0) AppLog.w("skipped ${store.damagedLines} damaged lines in the recordings")
        }
    }

    override fun onCreate() {
        super.onCreate()
        AppLog.start(File(filesDir, LOG_DIR))
        AppLog.i("started ${BuildConfig.VERSION_NAME} (build ${BuildConfig.VERSION_CODE})")
    }

    companion object {
        const val LOG_DIR = "logs"

        // Must match the backup rules in res/xml, which leave the recordings out.
        const val RECORDINGS_DIR = "recordings"

        // Thousands of notifications: far more than the week of recording milestone 1 needs.
        private const val MAX_RECORDINGS_BYTES = 5_000_000L
    }
}
