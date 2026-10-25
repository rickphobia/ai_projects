package com.rickphobia.gloss.core

import com.rickphobia.gloss.core.ai.Ai
import com.rickphobia.gloss.core.ai.AiPrompt
import com.rickphobia.gloss.core.ai.AiReply
import com.rickphobia.gloss.core.ai.TokenUsage
import com.rickphobia.gloss.core.context.Legado
import com.rickphobia.gloss.core.context.LegadoFailure
import com.rickphobia.gloss.core.context.LegadoReply
import com.rickphobia.gloss.core.context.ShelfBook

/** Records the prompts it was sent and answers each with [reply]. */
class FakeAi(
    private val reply: AiReply = answer("Meaning."),
) : Ai {
    val prompts = mutableListOf<AiPrompt>()

    override suspend fun ask(prompt: AiPrompt): AiReply {
        prompts += prompt
        return reply
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
