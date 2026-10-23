package com.rickphobia.ricknotes.core.revisionlog

import com.rickphobia.ricknotes.core.session.AutoSave
import com.rickphobia.ricknotes.core.session.Clock
import com.rickphobia.ricknotes.core.session.SaveListener
import com.rickphobia.ricknotes.core.session.SaveStatus
import com.rickphobia.ricknotes.core.session.writeSafely
import java.io.IOException
import java.nio.file.Files
import java.nio.file.NoSuchFileException
import java.nio.file.Path
import java.time.Instant
import java.time.ZoneId
import java.util.UUID

/**
 * One Course folder's Revision log: the seam the screens talk to (spec, "Revision log seam"). It
 * lives in the hidden [FOLDER] inside the Course folder: [LOG_FILE], the source of truth, and two
 * Snips per Entry. The log is saved like an Ink file, through an [AutoSave]: safely,
 * [SAVE_DELAY_MS] after the last change or at once on [saveNow], with a Version on open and at
 * most every [VERSION_INTERVAL_MS] while changing (decision 0007). It may be called from any
 * thread; the app keeps one per Course folder.
 */
class RevisionLogSession private constructor(
    private val folder: Path,
    private val clock: Clock,
    private val zone: ZoneId,
    listener: SaveListener,
    loaded: List<Entry>,
    /** Why the log couldn't be read, when it couldn't: it is then open read-only and never written. */
    val damaged: RevisionLogDamaged?,
) {
    val readOnly: Boolean = damaged != null

    private val all = loaded.toMutableList()
    private val saving =
        AutoSave(
            folder.resolve(LOG_FILE),
            clock,
            listener,
            readOnly,
            snapshot = { all.toList() },
        ) { RevisionLogCodec.encode(it).toByteArray(Charsets.UTF_8) }
    private val lock = saving.lock

    /** Every Entry, oldest first. */
    val entries: List<Entry> get() = synchronized(lock) { all.toList() }

    val status: SaveStatus get() = saving.status

    /**
     * Adds an Entry of [kind] from [source], first due [FIRST_GAP_DAYS] days from today. Its
     * [snips] are written before the Entry is, so the log never names a Snip that isn't there.
     * Writes files: call it off the main thread.
     *
     * @throws SnipSaveFailed if a Snip can't be written; no Entry is added.
     */
    fun addEntry(
        kind: EntryKind,
        source: EntrySource,
        snips: Snips,
    ): Entry {
        check(!readOnly) { "$LOG_FILE in ${folder.parent.fileName} is open read-only" }
        val now = clock.nowMs()
        val today = Instant.ofEpochMilli(now).atZone(zone).toLocalDate()
        val entry =
            Entry(
                id = EntryId(UUID.randomUUID().toString()),
                kind = kind,
                source = source,
                addedAtMs = now,
                schedule = Schedule(today.plusDays(FIRST_GAP_DAYS.toLong()), FIRST_GAP_DAYS),
            )
        writeSnip(frontSnip(entry), snips.front)
        writeSnip(backSnip(entry), snips.back)
        synchronized(lock) {
            all.add(entry)
            saving.changed()
        }
        return entry
    }

    /**
     * Sets the [category] (Mistakes only; null for none) and the one-line [why] of Entry [id]. A
     * blank [why] is none.
     *
     * @throws IllegalArgumentException if there is no such Entry, or [category] is given for a Key point.
     */
    fun edit(
        id: EntryId,
        category: MistakeCategory?,
        why: String?,
    ) {
        check(!readOnly) { "$LOG_FILE in ${folder.parent.fileName} is open read-only" }
        synchronized(lock) {
            val index = all.indexOfFirst { it.id == id }
            require(index >= 0) { "no Entry ${id.value}" }
            all[index] = all[index].copy(category = category, why = why?.trim()?.takeIf { it.isNotEmpty() })
            saving.changed()
        }
    }

    /** The PNG of [entry]'s area without ink. */
    fun frontSnip(entry: Entry): Path = folder.resolve("${entry.id.value}$FRONT_SUFFIX")

    /** The PNG of [entry]'s area with ink. */
    fun backSnip(entry: Entry): Path = folder.resolve("${entry.id.value}$BACK_SUFFIX")

    /** Saves any changes now, for when the app goes to the background. */
    fun saveNow() = saving.saveNow()

    private fun writeSnip(
        file: Path,
        png: ByteArray,
    ) {
        try {
            Files.createDirectories(folder)
            writeSafely(file, png)
        } catch (e: IOException) {
            throw SnipSaveFailed(file.fileName.toString(), e)
        } catch (e: SecurityException) {
            throw SnipSaveFailed(file.fileName.toString(), e)
        }
    }

    companion object {
        /** The hidden-from-the-tree folder inside a Course folder that holds its Revision log. */
        const val FOLDER = "_revision_log"
        const val LOG_FILE = "revision_log.json"
        private const val FRONT_SUFFIX = ".front.png"
        private const val BACK_SUFFIX = ".back.png"

        /** A new Entry is first due this many days after it is added. */
        const val FIRST_GAP_DAYS = 3

        const val SAVE_DELAY_MS = AutoSave.SAVE_DELAY_MS
        const val RETRY_DELAY_MS = AutoSave.RETRY_DELAY_MS
        const val VERSION_INTERVAL_MS = AutoSave.VERSION_INTERVAL_MS

        /**
         * Opens the Revision log of [courseFolder]; "today" is the date in [zone]. A missing log
         * starts empty; an unreadable one opens read-only and is never written.
         */
        fun open(
            courseFolder: Path,
            clock: Clock,
            zone: ZoneId,
            listener: SaveListener = object : SaveListener {},
        ): RevisionLogSession {
            val folder = courseFolder.resolve(FOLDER)
            val loaded =
                try {
                    load(folder.resolve(LOG_FILE))
                } catch (e: RevisionLogDamaged) {
                    // No Version of a damaged file: it would push a good Version out of the newest 10.
                    return RevisionLogSession(folder, clock, zone, listener, emptyList(), e)
                }
            return RevisionLogSession(folder, clock, zone, listener, loaded.orEmpty(), damaged = null).also {
                if (loaded != null) it.saving.takeVersion()
            }
        }

        // The log's Entries, or null if there is no log yet.
        private fun load(file: Path): List<Entry>? {
            val text =
                try {
                    // Not Files.readString: Android only has it from API 36.1, and the tablet is on 36.
                    String(Files.readAllBytes(file), Charsets.UTF_8)
                } catch (_: NoSuchFileException) {
                    return null
                } catch (e: IOException) {
                    throw RevisionLogDamaged(LOG_FILE, "can't read it", e)
                }
            return RevisionLogCodec.decode(text, LOG_FILE)
        }
    }
}
