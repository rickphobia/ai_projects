package com.rickphobia.gloss.core.context

/**
 * Finding a Selection in a chapter's text. What Android hands Gloss is the reader's screen, which
 * can differ from Legado's chapter text in spacing, line breaks, and quote and dash styles, so both
 * are compared in a canonical form and the match is mapped back to the chapter's own text.
 */
internal object ChapterMatch {
    /**
     * Where [selection] is in [chapter], as a range of the chapter's characters, or null when it
     * isn't there. When it occurs more than once, the occurrence nearest [readingPosition] wins.
     */
    fun find(
        chapter: String,
        selection: String,
        readingPosition: Int,
    ): IntRange? {
        val wanted = Canonical.of(selection).text.trim()
        val canonicalChapter = Canonical.of(chapter)
        val starts =
            generateSequence(canonicalChapter.text.indexOf(wanted).takeIf { it >= 0 }) { previous ->
                canonicalChapter.text.indexOf(wanted, previous + 1).takeIf { it >= 0 }
            }
        val nearest =
            starts
                .takeIf { wanted.isNotEmpty() }
                ?.minByOrNull { kotlin.math.abs(canonicalChapter.sourceIndex[it] - readingPosition) }
        return nearest?.let { canonicalChapter.sourceIndex[it]..canonicalChapter.sourceIndex[it + wanted.length - 1] }
    }
}

/**
 * [text] in canonical form: every run of whitespace is one space, curly quotes are straight, every
 * run of dashes is one '-' with no space around it, and '…' is "...". [sourceIndex] gives, for each
 * character of [text], the index of the character it came from.
 */
private class Canonical(
    val text: String,
    val sourceIndex: IntArray,
) {
    companion object {
        fun of(source: String): Canonical {
            val builder = Builder(source.length)
            source.forEachIndexed { index, char -> builder.add(char, index) }
            return Canonical(builder.text.toString(), builder.sourceIndex.toIntArray())
        }

        private const val ELLIPSIS_DOTS = 3

        /** Soft hyphen, zero-width space and joiners, and the byte-order mark: never on screen. */
        private val INVISIBLE = setOf('­', '​', '‌', '‍', '⁠', '﻿')

        /** Hyphens, figure dash, en and em dashes, horizontal bar, minus sign. */
        private val DASHES = setOf('‐', '‑', '‒', '–', '—', '―', '−')

        private val QUOTES =
            mapOf(
                '‘' to '\'',
                '’' to '\'',
                '‚' to '\'',
                '‛' to '\'',
                '′' to '\'',
                '“' to '"',
                '”' to '"',
                '„' to '"',
                '‟' to '"',
                '″' to '"',
                '«' to '"',
                '»' to '"',
            )
    }

    private class Builder(
        capacity: Int,
    ) {
        val text = StringBuilder(capacity)
        val sourceIndex = ArrayList<Int>(capacity)

        fun add(
            char: Char,
            index: Int,
        ) {
            when {
                char in INVISIBLE -> Unit
                char.isWhitespace() || Character.isSpaceChar(char) -> addSpace(index)
                char == '-' || char in DASHES -> addDash(index)
                char == '…' -> repeat(ELLIPSIS_DOTS) { emit('.', index) }
                else -> emit(QUOTES[char] ?: char, index)
            }
        }

        private fun addSpace(index: Int) {
            if (text.isNotEmpty() && text.last() != ' ' && text.last() != '-') emit(' ', index)
        }

        private fun addDash(index: Int) {
            if (text.lastOrNull() == ' ') {
                text.setLength(text.length - 1)
                sourceIndex.removeAt(sourceIndex.size - 1)
            }
            if (text.lastOrNull() != '-') emit('-', index)
        }

        private fun emit(
            char: Char,
            index: Int,
        ) {
            text.append(char)
            sourceIndex += index
        }
    }
}
