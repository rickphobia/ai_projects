package com.rickphobia.duitlog.storage

import android.content.Context
import androidx.sqlite.db.SupportSQLiteDatabase
import app.cash.sqldelight.driver.android.AndroidSqliteDriver
import com.rickphobia.duitlog.core.storage.DuitLogDatabase
import com.rickphobia.duitlog.logging.AppLog

/**
 * The app's database in its private storage. The file is opened (and on first run created, with
 * the default Categories) by the first query, not here, so opening never blocks the main thread.
 */
object PhoneDatabase {
    // Android Auto Backup copies this file with the app's other data (spec, "Backup").
    private const val FILE_NAME = "duit-log.db"

    fun create(context: Context): DuitLogDatabase =
        DuitLogDatabase(AndroidSqliteDriver(DuitLogDatabase.Schema, context, FILE_NAME, callback = LoggingCallback))

    private object LoggingCallback : AndroidSqliteDriver.Callback(DuitLogDatabase.Schema) {
        override fun onOpen(db: SupportSQLiteDatabase) {
            super.onOpen(db)
            // A problem seen on one phone can then be matched to its SQLite version (decision 0004).
            val sqliteVersion =
                db.query("SELECT sqlite_version()").use {
                    it.moveToFirst()
                    it.getString(0)
                }
            AppLog.i("database opened on SQLite $sqliteVersion")
        }
    }
}
