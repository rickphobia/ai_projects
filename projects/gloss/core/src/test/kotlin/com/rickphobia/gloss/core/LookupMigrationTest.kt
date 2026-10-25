package com.rickphobia.gloss.core

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import com.rickphobia.gloss.core.lookup.FollowUp
import com.rickphobia.gloss.core.lookup.Lookup
import com.rickphobia.gloss.core.lookup.LookupKind
import com.rickphobia.gloss.core.lookup.SqlLookupStore
import com.rickphobia.gloss.core.note.Note
import com.rickphobia.gloss.core.note.SqlNoteStore
import com.rickphobia.gloss.core.storage.GlossDatabase
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant

/** A phone on an older version keeps its Lookups when it upgrades. */
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

    @Test
    fun `a database from before Notes keeps its Lookups and takes Notes on them`() {
        val driver = JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY)
        GlossDatabase.Schema.create(driver)
        // Back to the schema ticket 05 left: no note table.
        driver.execute(null, "DROP TABLE note", 0)
        driver.execute(null, "INSERT INTO lookup(selection, answer, made_at) VALUES ('garret', 'A small room.', 0)", 0)

        GlossDatabase.Schema.migrate(driver, 3, GlossDatabase.Schema.version)

        val database = GlossDatabase(driver)
        val note = Note("garret", "Raskolnikov's room.", Instant.ofEpochMilli(1), lookupId = 1)
        runBlocking { SqlNoteStore(database).save(note) }
        assertEquals(listOf(note), runBlocking { SqlNoteStore(database).all() })
        assertEquals(1, runBlocking { SqlLookupStore(database).all() }.size)
    }
}
