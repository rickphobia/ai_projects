package com.rickphobia.gloss.core

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import com.rickphobia.gloss.core.context.BookLocation
import com.rickphobia.gloss.core.context.BookPlace
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
            runBlocking { lookups.all().map { it.value } },
        )
    }

    @Test
    fun `a database from before Notes keeps its Lookups and takes Notes on them`() {
        val driver = JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY)
        GlossDatabase.Schema.create(driver)
        // Back to the schema ticket 05 left: no note table, and no book on a Lookup.
        driver.execute(null, "DROP TABLE note", 0)
        recreateLookupWithoutBook(driver)
        driver.execute(null, "INSERT INTO lookup(selection, answer, made_at) VALUES ('garret', 'A small room.', 0)", 0)

        GlossDatabase.Schema.migrate(driver, 3, GlossDatabase.Schema.version)

        val database = GlossDatabase(driver)
        val note = Note("garret", "Raskolnikov's room.", Instant.ofEpochMilli(1), lookupId = 1)
        runBlocking { SqlNoteStore(database).save(note) }
        assertEquals(listOf(note), runBlocking { SqlNoteStore(database).all().map { it.value } })
        assertEquals(1, runBlocking { SqlLookupStore(database).all() }.size)
    }

    @Test
    fun `a Lookup from before Book pages takes the book of a Note on it, and the rest go under No book`() {
        val driver = JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY)
        GlossDatabase.Schema.create(driver)
        // Back to the schema ticket 06 left: Notes kept their book, Lookups didn't.
        recreateLookupWithoutBook(driver)
        driver.execute(null, "INSERT INTO lookup(selection, answer, made_at) VALUES ('garret', 'A small room.', 0)", 0)
        driver.execute(null, "INSERT INTO lookup(selection, answer, made_at) VALUES ('axe', 'A tool.', 1)", 0)
        val database = GlossDatabase(driver)
        val crime =
            BookLocation("Crime and Punishment", "Fyodor Dostoevsky", "Part I, Chapter 1", BookPlace("/c.epub", 3, 120))
        driver.execute(
            null,
            "INSERT INTO note(selection, text, written_at, book, author, chapter, book_url, chapter_index, " +
                "position, lookup_id) VALUES ('garret', 'His room.', 2, 'Crime and Punishment', " +
                "'Fyodor Dostoevsky', 'Part I, Chapter 1', '/c.epub', 3, 120, 1)",
            0,
        )

        GlossDatabase.Schema.migrate(driver, 4, GlossDatabase.Schema.version)

        assertEquals(listOf(crime, null), runBlocking { SqlLookupStore(database).all() }.map { it.value.book })
    }

    /** The lookup table as tickets 04 to 06 had it, without the book columns. */
    private fun recreateLookupWithoutBook(driver: JdbcSqliteDriver) {
        driver.execute(null, "DROP TABLE lookup", 0)
        driver.execute(
            null,
            "CREATE TABLE lookup (id INTEGER NOT NULL PRIMARY KEY, selection TEXT NOT NULL, " +
                "answer TEXT NOT NULL, made_at INTEGER NOT NULL, kind TEXT NOT NULL DEFAULT 'define')",
            0,
        )
    }
}
