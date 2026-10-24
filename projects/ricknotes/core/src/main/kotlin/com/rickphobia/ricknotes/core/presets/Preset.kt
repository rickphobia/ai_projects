package com.rickphobia.ricknotes.core.presets

/**
 * A named prompt sent along with a Document. [inkOn] says the AI should see the ink too, which
 * needs export (milestone 6); until then the bare PDF goes.
 */
data class Preset(
    val name: String,
    val prompt: String,
    val inkOn: Boolean,
)

/** The main spec's Default Presets, written to the Presets file the first time. */
val DEFAULT_PRESETS =
    listOf(
        Preset(
            "Chapter overview",
            "These are lecture slides. Give me a chapter overview: list the major concepts; under each, the " +
                "smaller concepts; for each smaller concept, an explain-like-I'm-five explanation, the key " +
                "formula, and one example question with its worked answer. Use the notation on the slides.",
            inkOn = false,
        ),
        Preset(
            "Answer only",
            "These are tutorial questions. Give only the final answer to each question, numbered as in the " +
                "document, with units. No working.",
            inkOn = true,
        ),
        Preset(
            "Hint",
            "I'm working on this tutorial question. Give me one hint that gets me to the next step. Do not " +
                "give the answer or any working beyond that step.",
            inkOn = true,
        ),
        Preset(
            "Full explanation",
            "Solve this tutorial question step by step. Show every step of working, say which formula or " +
                "rule each step uses, and give the final answer with units. Where my handwritten working is " +
                "visible, point out where it went wrong.",
            inkOn = true,
        ),
    )
