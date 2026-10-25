package com.rickphobia.gloss.core

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import com.rickphobia.gloss.core.lookup.FollowUp
import com.rickphobia.gloss.core.lookup.Lookup
import com.rickphobia.gloss.core.lookup.LookupKind
import com.rickphobia.gloss.core.lookup.SqlLookupStore
import com.rickphobia.gloss.core.storage.GlossDatabase
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant

/** A phone on version 0.4.0 (schema version 2) keeps its Lookups when it upgrades. */
class LookupMigrationTest {
    @Test
    fun `Lookups saved before Explain become Define Lookups and can take follow-ups after`() {
        val driver = JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY)
        // The schema as ticket 04 left it.
        driver.execute(
            null,
            "CREATE TABLE lookup (id INTEGER NOT NULL PRIMARY KEY, selection TEXT NOT NULL, " +
                "answer TEXT NOT NULL, made_at INTEGER NOT NULL)",
            0,
        )
        driver.execute(
            null,
            "CREATE TABLE spend (id INTEGER NOT NULL PRIMARY KEY, cost_micros INTEGER NOT NULL, " +
                "spent_at INTEGER NOT NULL)",
            0,
        )
        driver.execute(null, "INSERT INTO lookup(selection, answer, made_at) VALUES ('garret', 'A small room.', 0)", 0)

        GlossDatabase.Schema.migrate(driver, 2, GlossDatabase.Schema.version)

        val lookups = SqlLookupStore(GlossDatabase(driver))
        val explained = Lookup("axe", "A tool for chopping.", Instant.ofEpochMilli(1), LookupKind.Explain)
        runBlocking {
            val id = lookups.save(explained)
            lookups.addFollowUp(id, FollowUp("why an axe?", "It was what he had."))
        }
        assertEquals(
            listOf(
                Lookup("garret", "A small room.", Instant.EPOCH, LookupKind.Define),
                explained.copy(followUps = listOf(FollowUp("why an axe?", "It was what he had."))),
            ),
            runBlocking { lookups.all() },
        )
    }
}
