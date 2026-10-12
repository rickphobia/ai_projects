package com.rickphobia.duitlog.storage

import android.content.Context
import android.database.SQLException
import app.cash.sqldelight.driver.android.AndroidSqliteDriver
import com.rickphobia.duitlog.core.storage.DuitLogDatabase
import com.rickphobia.duitlog.core.storage.StorageCheck
import com.rickphobia.duitlog.core.storage.StorageCheckFailedException
import com.rickphobia.duitlog.logging.AppLog

/**
 * Runs core's [StorageCheck] on the phone's own SQLite, in an in-memory database so nothing is
 * left on disk. The result goes to the log: it shows the schema the JVM tests use also works here
 * (decision 0004).
 */
object PhoneStorageCheck {
    fun run(context: Context) {
        try {
            // name = null: an in-memory database.
            AndroidSqliteDriver(DuitLogDatabase.Schema, context, name = null).use { driver ->
                val result = StorageCheck.run(driver)
                AppLog.i("storage check passed on SQLite ${result.sqliteVersion}")
            }
        } catch (e: SQLException) {
            AppLog.e("storage check failed: SQLite refused the schema or a query", e)
        } catch (e: StorageCheckFailedException) {
            AppLog.e("storage check failed: ${e.message}", e)
        }
    }
}
