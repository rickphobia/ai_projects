package com.rickphobia.duitlog.core.storage

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import org.junit.Assert.assertTrue
import org.junit.Test

class StorageCheckTest {
    @Test
    fun `the schema is created and a row survives a round trip in an in-memory database`() {
        val driver = JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY)
        DuitLogDatabase.Schema.create(driver)

        val result = driver.use(StorageCheck::run)

        assertTrue(
            "expected a SQLite version like 3.x.y, got '${result.sqliteVersion}'",
            result.sqliteVersion.matches(Regex("""3\.\d+\.\d+""")),
        )
    }
}
