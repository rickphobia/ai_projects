package com.rickphobia.ricknotes.logpdf

import android.content.Context
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.revisionlog.Entry
import com.rickphobia.ricknotes.core.revisionlog.EntryKind
import com.rickphobia.ricknotes.revisionlog.label
import java.text.DateFormat
import java.util.Date

/** What an Entry's label lines in the Log PDF say: a [title] line, then [details] under it. */
internal class EntryLabel(
    val title: String,
    val details: String,
) {
    companion object {
        /** "Mistake · tut1.pdf p. 3 · 30 Oct 2026", then "Concept · Why: …" (either may be missing). */
        fun of(
            context: Context,
            entry: Entry,
        ): EntryLabel {
            val kindName = if (entry.kind == EntryKind.MISTAKE) R.string.edit_mistake else R.string.edit_key_point
            val date = DateFormat.getDateInstance(DateFormat.MEDIUM).format(Date(entry.addedAtMs))
            val document = entry.source.documentPath.substringAfterLast('/')
            val title =
                context.getString(
                    R.string.entry_title,
                    context.getString(kindName),
                    document,
                    entry.source.pageNumber,
                    date,
                )
            val details =
                listOfNotNull(
                    entry.category?.let { context.getString(it.label) },
                    entry.why?.let { context.getString(R.string.entry_why, it) },
                ).joinToString(" · ")
            return EntryLabel(title, details)
        }
    }
}
