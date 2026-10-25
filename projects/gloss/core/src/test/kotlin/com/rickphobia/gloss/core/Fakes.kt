package com.rickphobia.gloss.core

import com.rickphobia.gloss.core.ai.Ai
import com.rickphobia.gloss.core.ai.AiPrompt
import com.rickphobia.gloss.core.ai.AiReply
import com.rickphobia.gloss.core.ai.TokenUsage
import com.rickphobia.gloss.core.context.Legado
import com.rickphobia.gloss.core.context.LegadoFailure
import com.rickphobia.gloss.core.context.LegadoReply
import com.rickphobia.gloss.core.context.ShelfBook
import com.rickphobia.gloss.core.note.Note
import com.rickphobia.gloss.core.note.NoteStore
import com.rickphobia.gloss.core.settings.GlossSettings
import com.rickphobia.gloss.core.spending.ModelPrice
import com.rickphobia.gloss.core.spending.SpendStore
import java.time.Instant

/** Records the prompts it was sent and answers them with [replies] in turn, the last one again once they run out. */
class FakeAi(
    vararg replies: AiReply,
) : Ai {
    private val replies = replies.toList().ifEmpty { listOf(answer("Meaning.")) }
    val prompts = mutableListOf<AiPrompt>()

    override suspend fun ask(prompt: AiPrompt): AiReply {
        prompts += prompt
        return replies[minOf(prompts.size, replies.size) - 1]
    }
}

fun answer(text: String) = AiReply.Answer(text, TokenUsage(inputTokens = 80, outputTokens = 20))

/** A Legado serving [shelf] and the [chapters] by (book URL, index), or failing with [failure]. */
class FakeLegado(
    private val shelf: List<ShelfBook> = emptyList(),
    private val chapters: Map<Pair<String, Int>, String> = emptyMap(),
    private val failure: LegadoFailure? = null,
    private val chapterFailure: LegadoFailure? = null,
) : Legado {
    val chaptersAskedFor = mutableListOf<Pair<String, Int>>()

    override suspend fun bookshelf(): LegadoReply<List<ShelfBook>> =
        if (failure != null) LegadoReply.Failed(failure) else LegadoReply.Ok(shelf)

    override suspend fun chapterText(
        bookUrl: String,
        chapterIndex: Int,
    ): LegadoReply<String> {
        chaptersAskedFor += bookUrl to chapterIndex
        val text = chapters[bookUrl to chapterIndex]
        return when {
            chapterFailure != null -> LegadoReply.Failed(chapterFailure)
            text == null -> LegadoReply.Failed(LegadoFailure.Error)
            else -> LegadoReply.Ok(text)
        }
    }

    companion object {
        val off = FakeLegado(failure = LegadoFailure.Off)
    }
}

/** Crime and Punishment, at chapter 3 ("Part I, Chapter 1"), unless told otherwise. */
fun shelfBook(
    url: String = "/storage/emulated/0/Books/crime-and-punishment.epub",
    name: String = "Crime and Punishment",
    position: Int = 0,
    lastReadAt: Long = 1_761_300_000_000,
) = ShelfBook(url, name, "Fyodor Dostoevsky", 3, "Part I, Chapter 1", position, lastReadAt)

/** Haiku 5.5 and Sonnet 5.5 at their prices and a $10 Spending limit, as on the phone. */
val testSettings =
    GlossSettings(
        defineModel = "claude-haiku-5-5",
        definePrice =
            ModelPrice(
                100_000,
                500_000,
                cacheWriteMicrosPerMillion = 125_000,
                cacheReadMicrosPerMillion = 10_000,
            ),
        defineMaxTokens = 150,
        explainModel = "claude-sonnet-5-5",
        explainPrice =
            ModelPrice(
                2_000_000,
                10_000_000,
                cacheWriteMicrosPerMillion = 2_500_000,
                cacheReadMicrosPerMillion = 200_000,
            ),
        explainMaxTokens = 1024,
        explainEffort = "low",
        contextWordLimit = 3000,
        spendingLimitMicros = 10_000_000,
    )

/** Spends kept in a list. */
class FakeSpendStore : SpendStore {
    val spends = mutableListOf<Pair<Long, Instant>>()

    override suspend fun add(
        costMicros: Long,
        at: Instant,
    ) {
        spends += costMicros to at
    }

    override suspend fun totalBetween(
        from: Instant,
        until: Instant,
    ): Long = spends.filter { (_, at) -> at >= from && at < until }.sumOf { it.first }
}

/** Notes kept in a list, for tests that don't write any. */
class FakeNoteStore : NoteStore {
    private val notes = mutableListOf<Note>()

    override suspend fun save(note: Note): Long {
        notes += note
        return notes.size.toLong()
    }

    override suspend fun all(): List<Note> = notes.toList()
}
