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

/**
 * The Default Presets of the main spec and of Send both Panes, written to the Presets file the first
 * time. An existing file never gets new ones: the README gives them for pasting in.
 */
val DEFAULT_PRESETS =
    listOf(
        Preset(
            "Chapter overview",
            "These are lecture slides. Give me a chapter overview: list the major concepts; under each, the " +
                "smaller concepts; for each smaller concept, an explain-like-I'm-five explanation, the key " +
                "formula, and one example question with its worked answer. Use the notation on the slides.",
            inkOn = false,
        ),
        // For Both Panes; Android doesn't promise the order the two PDFs arrive in, so it never relies on it.
        Preset(
            "Overview with tutorial",
            "One PDF is lecture slides and the other is the tutorial for the same topic; tell them apart by " +
                "their content. Give me a chapter overview of the lecture: list the major concepts; under " +
                "each, the smaller concepts; for each smaller concept, an explain-like-I'm-five explanation, " +
                "the key formula, and the tutorial questions that use it, by their number in the tutorial. " +
                "Then list any tutorial question that no concept covers. Use the notation on the slides. Do " +
                "not solve the tutorial questions.",
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
