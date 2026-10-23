package com.rickphobia.ricknotes.core.revisionlog

import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.session.PageRect
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import java.time.LocalDate
import java.time.format.DateTimeParseException

/** Turns a Revision log's Entries into the text of `revision_log.json`, and back. */
internal object RevisionLogCodec {
    /** Raised whenever the layout below changes in a way an older app couldn't read. */
    const val FORMAT_VERSION = 1

    private val json =
        Json {
            prettyPrint = true
            // A newer app may add fields; the format version decides whether we can still read it.
            ignoreUnknownKeys = true
        }

    fun encode(entries: List<Entry>): String =
        json.encodeToString(RevisionLogJson.serializer(), RevisionLogJson(FORMAT_VERSION, entries.map { it.toJson() }))

    /** @throws RevisionLogDamaged if [text] isn't a Revision log this version of the app can read. */
    fun decode(
        text: String,
        fileName: String,
    ): List<Entry> =
        try {
            val log = json.decodeFromString(RevisionLogJson.serializer(), text)
            require(log.formatVersion <= FORMAT_VERSION) {
                "format version ${log.formatVersion} is newer than this app reads"
            }
            log.entries.map { entry ->
                try {
                    entry.toEntry()
                } catch (e: IllegalArgumentException) {
                    throw IllegalArgumentException("Entry ${entry.id}: ${e.message}", e)
                }
            }
        } catch (e: SerializationException) {
            throw RevisionLogDamaged(fileName, "not valid Revision log JSON", e)
        } catch (e: IllegalArgumentException) {
            throw RevisionLogDamaged(fileName, e.message.orEmpty(), e)
        }

    private fun Entry.toJson() =
        EntryJson(
            id = id.value,
            kind = kind.name.lowercase(),
            document = source.documentPath,
            page = source.pageId.value,
            pageNumber = source.pageNumber,
            area = source.area.let { AreaJson(it.left, it.top, it.right, it.bottom) },
            addedAtMs = addedAtMs,
            dueDate = schedule.dueDate.toString(),
            gapDays = schedule.gapDays,
            category = category?.name?.lowercase(),
            why = why,
            ratings = ratings.map { RatingJson(it.atMs, it.grade.name.lowercase()) },
        )

    private fun EntryJson.toEntry(): Entry =
        Entry(
            id = EntryId(id),
            kind = named(EntryKind.entries, kind, "kind"),
            source =
                EntrySource(
                    document,
                    PageId(page),
                    pageNumber,
                    PageRect(area.left, area.top, area.right, area.bottom),
                ),
            addedAtMs = addedAtMs,
            schedule = Schedule(date(dueDate), gapDays),
            category = category?.let { named(MistakeCategory.entries, it, "category") },
            why = why,
            ratings = ratings.map { Rating(it.atMs, named(Grade.entries, it.grade, "grade")) },
        )

    private fun <E : Enum<E>> named(
        values: List<E>,
        name: String,
        what: String,
    ): E = requireNotNull(values.firstOrNull { it.name.lowercase() == name }) { "unknown $what \"$name\"" }

    private fun date(text: String): LocalDate =
        try {
            LocalDate.parse(text)
        } catch (e: DateTimeParseException) {
            throw IllegalArgumentException("due date \"$text\" is not YYYY-MM-DD", e)
        }
}

@Serializable
private data class RevisionLogJson(
    val formatVersion: Int,
    val entries: List<EntryJson>,
)

@Serializable
private data class EntryJson(
    val id: String,
    val kind: String,
    val document: String,
    val page: String,
    val pageNumber: Int,
    val area: AreaJson,
    val addedAtMs: Long,
    val dueDate: String,
    val gapDays: Int,
    val category: String? = null,
    val why: String? = null,
    // Logs from before Review have no ratings.
    val ratings: List<RatingJson> = emptyList(),
)

@Serializable
private data class RatingJson(
    val atMs: Long,
    val grade: String,
)

@Serializable
private data class AreaJson(
    val left: Float,
    val top: Float,
    val right: Float,
    val bottom: Float,
)
