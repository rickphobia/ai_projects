package com.rickphobia.gloss.storage

import android.content.Context
import app.cash.sqldelight.driver.android.AndroidSqliteDriver
import com.rickphobia.gloss.core.storage.GlossDatabase

/**
 * The app's database in its private storage, excluded from backup (res/xml). The file is opened,
 * and on first run created, by the first query, not here.
 */
object PhoneDatabase {
    private const val FILE_NAME = "gloss.db"

    fun create(context: Context): GlossDatabase =
        GlossDatabase(AndroidSqliteDriver(GlossDatabase.Schema, context, FILE_NAME))
}
