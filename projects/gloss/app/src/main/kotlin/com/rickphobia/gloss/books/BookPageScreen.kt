package com.rickphobia.gloss.books

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.rickphobia.gloss.R
import com.rickphobia.gloss.core.bookpage.BookSummary
import com.rickphobia.gloss.core.bookpage.ChapterSection
import com.rickphobia.gloss.core.bookpage.LookupEntry
import com.rickphobia.gloss.core.bookpage.NoteEntry

/** A Book page: the book's Lookups and Notes in reading order, under their chapters' titles. */
@Composable
fun BookPageScreen(
    book: BookSummary,
    chapters: List<ChapterSection>?,
    actions: EntryActions,
    onShare: () -> Unit,
    onBack: () -> Unit,
) {
    var toDelete by rememberLookupToDelete()
    ScreenFrame(
        title = bookTitle(book.book),
        onBack = onBack,
        action = {
            TextButton(
                onClick = onShare,
                enabled = chapters != null,
            ) { Text(stringResource(R.string.share_book)) }
        },
    ) {
        if (chapters == null) {
            LinearProgressIndicator(modifier = Modifier.padding(16.dp))
            return@ScreenFrame
        }
        LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            chapters.forEach { section ->
                val heading = section.chapter?.takeIf(String::isNotBlank)
                heading?.let { title ->
                    item(key = "chapter-${section.chapterIndex}") { Heading(title) }
                }
                items(section.entries, key = { "${it::class.simpleName}-${it.id}" }) { entry ->
                    when (entry) {
                        is LookupEntry -> {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                LookupRow(
                                    entry,
                                    onOpen = { actions.onOpenLookup(entry.id) },
                                    onDelete = { toDelete = it },
                                )
                                entry.notes.forEach { note ->
                                    NoteRow(note, actions.onEditNote, actions.onDeleteNote, quoteSelection = false)
                                }
                            }
                        }

                        is NoteEntry -> {
                            NoteRow(entry, actions.onEditNote, actions.onDeleteNote)
                        }
                    }
                }
            }
        }
    }
    toDelete?.let { entry ->
        ConfirmDeleteLookup(entry, onConfirm = { actions.onDeleteLookup(entry.id) }, onClose = { toDelete = null })
    }
}

/** A past Lookup, read again: the Selection, where it was, the answer and the whole chat, and its Notes. */
@Composable
fun LookupScreen(
    entry: LookupEntry?,
    actions: EntryActions,
    onBack: () -> Unit,
) {
    var toDelete by rememberLookupToDelete()
    val title = if (entry == null) "" else bookTitle(entry.lookup.book?.book)
    ScreenFrame(title = title, onBack = onBack) {
        if (entry == null) {
            LinearProgressIndicator(modifier = Modifier.padding(16.dp))
            return@ScreenFrame
        }
        Column(
            modifier = Modifier.verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            val lookup = entry.lookup
            SelectionQuote(lookup.selection)
            lookup.book
                ?.chapter
                ?.takeIf(String::isNotEmpty)
                ?.let { SmallLine(it) }
            Text(lookup.answer, style = MaterialTheme.typography.bodyLarge)
            lookup.followUps.forEach { followUp ->
                Text(
                    followUp.question,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary,
                )
                Text(followUp.answer, style = MaterialTheme.typography.bodyLarge)
            }
            entry.notes.forEach { NoteRow(it, actions.onEditNote, actions.onDeleteNote, quoteSelection = false) }
            OutlinedButton(onClick = { toDelete = entry }) { Text(stringResource(R.string.delete_lookup)) }
        }
    }
    toDelete?.let { doomed ->
        ConfirmDeleteLookup(doomed, onConfirm = { actions.onDeleteLookup(doomed.id) }, onClose = { toDelete = null })
    }
}
