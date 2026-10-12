package com.rickphobia.duitlog

import android.app.Application
import com.rickphobia.duitlog.logging.AppLog
import com.rickphobia.duitlog.storage.PhoneStorageCheck
import java.io.File

/**
 * Starts what every part of the app needs, once per process: the log (so a notification listener
 * started without the activity logs too) and the storage check.
 */
class DuitLogApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        AppLog.start(File(filesDir, LOG_DIR))
        AppLog.i("started ${BuildConfig.VERSION_NAME} (build ${BuildConfig.VERSION_CODE})")
        PhoneStorageCheck.run(this)
    }

    companion object {
        const val LOG_DIR = "logs"
    }
}
