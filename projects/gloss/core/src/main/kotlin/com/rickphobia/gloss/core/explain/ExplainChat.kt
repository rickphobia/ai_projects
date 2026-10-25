package com.rickphobia.gloss.core.explain

import com.rickphobia.gloss.core.Selection
import com.rickphobia.gloss.core.context.BookContextResult
import com.rickphobia.gloss.core.lookup.FollowUp

/** An Explain chat as the card shows it, and as a follow-up continues it. */
data class ExplainChat(
    /** The saved Lookup that follow-ups are added to. */
    val lookupId: Long,
    val selection: Selection,
    /** The Book context every turn uses, or why there is none. */
    val context: BookContextResult,
    /** The first answer. */
    val explanation: String,
    val followUps: List<FollowUp> = emptyList(),
)
