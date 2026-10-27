package com.rickphobia.ricknotes.core.revisionlog

import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.ink.StrokeId
import com.rickphobia.ricknotes.core.session.AutoSave
import com.rickphobia.ricknotes.core.session.Clock
import com.rickphobia.ricknotes.core.session.PageRect
import com.rickphobia.ricknotes.core.session.SaveListener
import com.rickphobia.ricknotes.core.session.SaveStatus
import com.rickphobia.ricknotes.core.session.writeSafely
import java.io.IOException
import java.nio.file.Files
import java.nio.file.NoSuchFileException
import java.nio.file.Path
import java.time.Instant
import java.time.LocalDate
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
    loaded: Loaded,
) {
    /** Why the log couldn't be read, when it couldn't: it is then open read-only and never written. */
    val damaged: RevisionLogDamaged? = loaded.damaged

    /** The sync app's Conflict copies of the log, by file name. Only warned about, never merged. */
    val conflictCopies: List<String> = loaded.conflictCopies

    val readOnly: Boolean = damaged != null

    private val all = loaded.entries.toMutableList()
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
     * Adds an Entry of [kind] from [source], first due [ReviewSchedule.FIRST_GAP_DAYS] days from today. Its
     * [snips] are written before the Entry is, so the log never names a Snip that isn't there.
     * [redStrokeIds] are the red strokes it came from and [box] the Red mark's box, if any.
     * Writes files: call it off the main thread.
     *
     * @throws SnipSaveFailed if a Snip can't be written; no Entry is added.
     */
    fun addEntry(
        kind: EntryKind,
        source: EntrySource,
        snips: Snips,
        redStrokeIds: List<StrokeId> = emptyList(),
        box: PageRect? = null,
    ): Entry {
        check(!readOnly) { "$LOG_FILE in ${folder.parent.fileName} is open read-only" }
        val now = clock.nowMs()
        val entry =
            Entry(
                id = EntryId(UUID.randomUUID().toString()),
                kind = kind,
                source = source,
                addedAtMs = now,
                schedule = ReviewSchedule.first(dayIn(zone, now)),
                redStrokeIds = redStrokeIds,
                box = box,
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

    /**
     * Deletes Entry [id] from the log. Its Snips stay on disk: a Version of the log restored later
     * still names them.
     *
     * @throws IllegalArgumentException if there is no such Entry.
     */
    fun delete(id: EntryId) {
        check(!readOnly) { "$LOG_FILE in ${folder.parent.fileName} is open read-only" }
        synchronized(lock) {
            require(all.removeAll { it.id == id }) { "no Entry ${id.value}" }
            saving.changed()
        }
    }

    /**
     * Rates Entry [id] with [grade] in Review: keeps the rating and moves its due date as
     * [ReviewSchedule] says. Saved like any change.
     *
     * @throws IllegalArgumentException if there is no such Entry.
     */
    fun rate(
        id: EntryId,
        grade: Grade,
    ): Entry {
        check(!readOnly) { "$LOG_FILE in ${folder.parent.fileName} is open read-only" }
        val now = clock.nowMs()
        synchronized(lock) {
            val index = all.indexOfFirst { it.id == id }
            require(index >= 0) { "no Entry ${id.value}" }
            val entry = all[index]
            all[index] =
                entry.copy(
                    schedule = ReviewSchedule.after(entry.schedule, grade, dayIn(zone, now)),
                    ratings = entry.ratings + Rating(now, grade),
                )
            saving.changed()
            return all[index]
        }
    }

    /**
     * Keeps a Redo of Mistake [id]: its [strokes], written now. Saved like any change.
     *
     * @throws IllegalArgumentException if there is no such Entry, it is a Key point, or [strokes] is empty.
     */
    fun addRedo(
        id: EntryId,
        strokes: List<Stroke>,
    ): Entry {
        check(!readOnly) { "$LOG_FILE in ${folder.parent.fileName} is open read-only" }
        val redo = Redo(clock.nowMs(), strokes)
        synchronized(lock) {
            val index = all.indexOfFirst { it.id == id }
            require(index >= 0) { "no Entry ${id.value}" }
            all[index] = all[index].copy(redos = all[index].redos + redo)
            saving.changed()
            return all[index]
        }
    }

    /** The Entries due today or earlier in the tablet's time zone: oldest due first, then oldest added. */
    fun due(): List<Entry> {
        val today = dayIn(zone, clock.nowMs())
        return entries
            .filter { !it.schedule.dueDate.isAfter(today) }
            .sortedWith(compareBy({ it.schedule.dueDate }, { it.addedAtMs }))
    }

    /** The Entries newest first, only those of [kind] when it is given. */
    fun newestFirst(kind: EntryKind?): List<Entry> =
        entries.filter { kind == null || it.kind == kind }.sortedByDescending { it.addedAtMs }

    /** The PNG of [entry]'s area without ink. */
    fun frontSnip(entry: Entry): Path = folder.resolve("${entry.id.value}$FRONT_SUFFIX")

    /** The PNG of [entry]'s area with ink. */
    fun backSnip(entry: Entry): Path = folder.resolve("${entry.id.value}$BACK_SUFFIX")

    /** Saves any changes now, for when the app goes to the background. */
    fun saveNow() = saving.saveNow()

    // What open found on disk.
    private class Loaded(
        val entries: List<Entry>,
        val damaged: RevisionLogDamaged?,
        val conflictCopies: List<String>,
    )

    companion object {
        /** The hidden-from-the-tree folder inside a Course folder that holds its Revision log. */
        const val FOLDER = "_revision_log"
        const val LOG_FILE = "revision_log.json"
        private const val FRONT_SUFFIX = ".front.png"
        private const val BACK_SUFFIX = ".back.png"

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
            val conflicts = conflictCopiesIn(folder)
            val loaded =
                try {
                    load(folder.resolve(LOG_FILE))
                } catch (e: RevisionLogDamaged) {
                    // No Version of a damaged file: it would push a good Version out of the newest 10.
                    return RevisionLogSession(folder, clock, zone, listener, Loaded(emptyList(), e, conflicts))
                }
            return RevisionLogSession(folder, clock, zone, listener, Loaded(loaded.orEmpty(), null, conflicts)).also {
                if (loaded != null) it.saving.takeVersion()
            }
        }

        /*
         * FolderSync's exact Conflict copy naming isn't documented, so any visible file other than
         * the log whose name starts with the log's own name counts: "revision_log (1).json",
         * "revision_log.json.conflict" and the like. Hidden files are the app's own temporary files.
         */
        private fun conflictCopiesIn(folder: Path): List<String> {
            if (!Files.isDirectory(folder)) return emptyList()
            val stem = LOG_FILE.substringBeforeLast('.')
            return Files.list(folder).use { files ->
                files
                    .map { it.fileName.toString() }
                    .filter { it != LOG_FILE && it.startsWith(stem) }
                    .sorted()
                    .toList()
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

/** The date at [epochMs] in [zone]. */
private fun dayIn(
    zone: ZoneId,
    epochMs: Long,
): LocalDate = Instant.ofEpochMilli(epochMs).atZone(zone).toLocalDate()

/** Writes the Snip [file], making its folder if needed. */
private fun writeSnip(
    file: Path,
    png: ByteArray,
) {
    try {
        Files.createDirectories(file.parent)
        writeSafely(file, png)
    } catch (e: IOException) {
        throw SnipSaveFailed(file.fileName.toString(), e)
    } catch (e: SecurityException) {
        throw SnipSaveFailed(file.fileName.toString(), e)
    }
}
