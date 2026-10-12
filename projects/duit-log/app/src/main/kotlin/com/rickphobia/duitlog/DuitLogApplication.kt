package com.rickphobia.duitlog

import android.app.Application
import com.rickphobia.duitlog.core.ledger.Ledger
import com.rickphobia.duitlog.logging.AppLog
import com.rickphobia.duitlog.storage.PhoneClock
import com.rickphobia.duitlog.storage.PhoneDatabase
import java.io.File

/**
 * Starts what every part of the app needs, once per process: the log (so a notification listener
 * started without the activity logs too) and the Ledger.
 */
class DuitLogApplication : Application() {
    val ledger: Ledger by lazy { Ledger(PhoneDatabase.create(this), PhoneClock()) }

    override fun onCreate() {
        super.onCreate()
        AppLog.start(File(filesDir, LOG_DIR))
        AppLog.i("started ${BuildConfig.VERSION_NAME} (build ${BuildConfig.VERSION_CODE})")
    }

    companion object {
        const val LOG_DIR = "logs"
    }
}
