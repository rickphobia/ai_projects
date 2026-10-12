package com.rickphobia.duitlog.core.storage

import app.cash.sqldelight.db.SqlDriver

/** What [StorageCheck.run] found: the SQLite the schema ran on. */
data class StorageCheckResult(
    val sqliteVersion: String,
)

/** The schema ran, but a row came back different from how it was written. */
class StorageCheckFailedException(
    message: String,
) : IllegalStateException(message)

/**
 * Proves the schema works on a driver: writes a row and reads it back. The JVM tests run it on
 * an in-memory sqlite-jdbc database and the app on an in-memory Android database, so both run
 * the same schema (decision 0004).
 */
object StorageCheck {
    private const val AMOUNT_SEN = 12_345L
    private const val LABEL = "storage check"

    /** [driver] must already have the schema ([DuitLogDatabase.Schema]) created. */
    fun run(driver: SqlDriver): StorageCheckResult {
        val queries = DuitLogDatabase(driver).storageProbeQueries
        queries.insert(amount_sen = AMOUNT_SEN, label = LABEL)
        val rows = queries.all().executeAsList().map { it.amount_sen to it.label }
        if (rows != listOf(AMOUNT_SEN to LABEL)) {
            throw StorageCheckFailedException("wrote ($AMOUNT_SEN, $LABEL), read back $rows")
        }
        return StorageCheckResult(sqliteVersion = queries.sqliteVersion().executeAsOne())
    }
}
