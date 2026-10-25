package com.rickphobia.gloss.books

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.rickphobia.gloss.R
import com.rickphobia.gloss.core.bookpage.BookSummary
import com.rickphobia.gloss.core.bookpage.Entry
import com.rickphobia.gloss.core.bookpage.LookupEntry
import com.rickphobia.gloss.core.bookpage.NoteEntry

/** What Gloss opens to: the Books it holds, most recent first, and the Recent Lookups and Notes. */
@Composable
fun ShelfScreen(
    books: List<BookSummary>,
    recent: List<Entry>,
    onOpenBook: (BookSummary) -> Unit,
    onOpenLookup: (Long) -> Unit,
    onEditNote: (Long, String) -> Unit,
    onDeleteNote: (Long) -> Unit,
    onOpenSettings: () -> Unit,
) {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    ScreenFrame(
        title = stringResource(R.string.app_name),
        onBack = null,
        action = { TextButton(onClick = onOpenSettings) { Text(stringResource(R.string.settings)) } },
    ) {
        PrimaryTabRow(selectedTabIndex = tab) {
            Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text(stringResource(R.string.books_tab)) })
            Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text(stringResource(R.string.recent_tab)) })
        }
        if (books.isEmpty()) {
            Text(
                stringResource(R.string.books_empty),
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.padding(16.dp),
            )
            return@ScreenFrame
        }
        when (tab) {
            0 -> BookList(books, onOpenBook)
            else -> RecentList(recent, onOpenLookup, onEditNote, onDeleteNote)
        }
    }
}

@Composable
private fun BookList(
    books: List<BookSummary>,
    onOpenBook: (BookSummary) -> Unit,
) {
    LazyColumn {
        items(books, key = { it.bookUrl.orEmpty() }) { book ->
            Column(modifier = Modifier.fillMaxWidth().clickable { onOpenBook(book) }.padding(16.dp)) {
                Text(bookTitle(book.book), style = MaterialTheme.typography.titleMedium)
                book.author?.takeIf(String::isNotEmpty)?.let { SmallLine(it) }
            }
            HorizontalDivider()
        }
    }
}

@Composable
private fun RecentList(
    recent: List<Entry>,
    onOpenLookup: (Long) -> Unit,
    onEditNote: (Long, String) -> Unit,
    onDeleteNote: (Long) -> Unit,
) {
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items(recent, key = { "${it::class.simpleName}-${it.id}" }) { entry ->
            val where = whereLine(entry)
            when (entry) {
                is LookupEntry -> LookupRow(entry, onOpen = { onOpenLookup(entry.id) }, onDelete = null, above = where)
                is NoteEntry -> NoteRow(entry, onEditNote, onDeleteNote, above = where)
            }
        }
    }
}

/** "Crime and Punishment · Part I, Chapter 1", or "No book". */
@Composable
private fun whereLine(entry: Entry): String =
    entry.book?.let { listOf(it.book, it.chapter).filter(String::isNotEmpty).joinToString(" · ") }
        ?: stringResource(R.string.no_book)

/** A book's name, or "No book" for what was looked up or noted without Book context. */
@Composable
internal fun bookTitle(book: String?): String = book ?: stringResource(R.string.no_book)

/** A screen of Gloss's own: a title row with back or an action, over [content]. */
@Composable
internal fun ScreenFrame(
    title: String,
    onBack: (() -> Unit)?,
    action: @Composable () -> Unit = {},
    content: @Composable () -> Unit,
) {
    Surface(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.safeDrawingPadding()) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                onBack?.let { TextButton(onClick = it) { Text(stringResource(R.string.back)) } }
                Text(
                    title,
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.weight(1f).padding(horizontal = 8.dp),
                    maxLines = 1,
                )
                action()
            }
            content()
        }
    }
}
