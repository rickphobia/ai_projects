package com.rickphobia.gloss.core

/** The text the owner highlighted in the reader and sent to Gloss from the selection menu. */
@JvmInline
value class Selection private constructor(
    val text: String,
) {
    companion object {
        /**
         * The Selection in the text a reader app handed over, or null when there is nothing to
         * look up. Readers often include the space or line break next to a word, so that is dropped.
         */
        fun from(selectedText: CharSequence?): Selection? =
            selectedText
                ?.toString()
                ?.trim()
                ?.takeIf(String::isNotEmpty)
                ?.let(::Selection)
    }
}
