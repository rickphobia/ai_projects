package com.rickphobia.duitlog.core.storage

import app.cash.sqldelight.db.QueryResult
import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import org.junit.Assert.assertEquals
import org.junit.Test

class MigrationTest {
    @Test
    fun `a version 1 database keeps its Transactions and gains the Excluded flag`() {
        val driver = JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY)
        // The ledger_transaction table as version 0.2.0 created it.
        driver.execute(
            null,
            """
            CREATE TABLE ledger_transaction (
              id INTEGER NOT NULL PRIMARY KEY,
              kind TEXT NOT NULL CHECK (kind IN ('EXPENSE', 'INCOME')),
              amount_sen INTEGER NOT NULL CHECK (amount_sen > 0),
              occurred_at INTEGER NOT NULL,
              merchant TEXT NOT NULL,
              category_id INTEGER,
              note TEXT
            )
            """.trimIndent(),
            0,
        )
        driver.execute(
            null,
            "INSERT INTO ledger_transaction(kind, amount_sen, occurred_at, merchant) " +
                "VALUES ('EXPENSE', 500, 0, 'Kedai')",
            0,
        )

        DuitLogDatabase.Schema.migrate(driver, 1, DuitLogDatabase.Schema.version)

        val excluded =
            driver
                .executeQuery(null, "SELECT excluded FROM ledger_transaction", { cursor ->
                    cursor.next()
                    QueryResult.Value(cursor.getLong(0))
                }, 0)
                .value
        assertEquals(0L, excluded)
    }

    @Test
    fun `a version 2 database keeps its Transactions as hand-added and gains the Couldn't read list`() {
        val driver = JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY)
        // The ledger_transaction table as version 2 (ticket 04) created it.
        driver.execute(
            null,
            """
            CREATE TABLE ledger_transaction (
              id INTEGER NOT NULL PRIMARY KEY,
              kind TEXT NOT NULL CHECK (kind IN ('EXPENSE', 'INCOME')),
              amount_sen INTEGER NOT NULL CHECK (amount_sen > 0),
              occurred_at INTEGER NOT NULL,
              merchant TEXT NOT NULL,
              category_id INTEGER,
              note TEXT,
              excluded INTEGER NOT NULL DEFAULT 0 CHECK (excluded IN (0, 1))
            )
            """.trimIndent(),
            0,
        )
        driver.execute(
            null,
            "INSERT INTO ledger_transaction(kind, amount_sen, occurred_at, merchant) " +
                "VALUES ('EXPENSE', 500, 0, 'Kedai')",
            0,
        )

        DuitLogDatabase.Schema.migrate(driver, 2, DuitLogDatabase.Schema.version)

        val wallet =
            driver
                .executeQuery(null, "SELECT wallet FROM ledger_transaction", { cursor ->
                    cursor.next()
                    QueryResult.Value(cursor.getString(0))
                }, 0)
                .value
        assertEquals(null, wallet)
        assertEquals(emptyList<Any>(), DuitLogDatabase(driver).couldntReadQueries.all().executeAsList())
        assertEquals(3L, DuitLogDatabase.Schema.version)
    }
}
