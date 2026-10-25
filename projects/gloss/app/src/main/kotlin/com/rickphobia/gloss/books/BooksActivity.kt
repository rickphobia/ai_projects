package com.rickphobia.gloss.books

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.core.content.FileProvider
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.rickphobia.gloss.GlossApplication
import com.rickphobia.gloss.R
import com.rickphobia.gloss.card.GlossTheme
import com.rickphobia.gloss.settings.PhoneSettings
import com.rickphobia.gloss.settings.SettingsActivity
import java.io.File

/**
 * Gloss's launcher screen: the Books screen with Recent, Book pages and past Lookups. Until a key
 * is saved it opens the first-run key screen over itself.
 */
class BooksActivity : ComponentActivity() {
    private val books: BooksViewModel by viewModels {
        val app = application as GlossApplication
        viewModelFactory {
            initializer { BooksViewModel(app.gloss.bookPages, PhoneSettings.RECENT_ENTRIES, app.log) }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val app = application as GlossApplication
        if (savedInstanceState == null && !app.apiKeys.hasKey()) {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
        val actions =
            EntryActions(
                onOpenLookup = { books.open(BooksPlace.Lookup(it)) },
                onEditNote = books::editNote,
                onDeleteNote = books::deleteNote,
                onDeleteLookup = books::deleteLookup,
            )
        setContent {
            BackHandler(enabled = books.stack.size > 1) { books.back() }
            GlossTheme {
                when (val place = books.current) {
                    BooksPlace.Shelf -> {
                        ShelfScreen(
                            books = books.books,
                            recent = books.recent,
                            onOpenBook = { books.open(BooksPlace.Book(it)) },
                            actions = actions,
                            onOpenSettings = { startActivity(Intent(this, SettingsActivity::class.java)) },
                        )
                    }

                    is BooksPlace.Book -> {
                        BookPageScreen(
                            place.summary,
                            books.page,
                            actions,
                            onShare = { books.shareBook(place.summary, ::sendMarkdown) },
                            onBack = { books.back() },
                        )
                    }

                    is BooksPlace.Lookup -> {
                        LookupScreen(books.lookup, actions, onBack = { books.back() })
                    }
                }
            }
        }
    }

    /** The owner may have looked something up or written a Note from the card since. */
    override fun onResume() {
        super.onResume()
        books.reload()
    }

    /** Writes [markdown] to the cache, where only the share sheet's chosen app may read it, and sends it. */
    private fun sendMarkdown(markdown: String) {
        val file = File(cacheDir, "exports/${fileName(markdown)}.md")
        file.parentFile?.mkdirs()
        file.writeText(markdown)
        val uri = FileProvider.getUriForFile(this, "$packageName.logs", file)
        val send =
            Intent(Intent.ACTION_SEND)
                .setType("text/markdown")
                .putExtra(Intent.EXTRA_STREAM, uri)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        startActivity(Intent.createChooser(send, getString(R.string.share_book)))
    }

    /** The book's title from the Markdown's first line, with only characters every app keeps in a file name. */
    private fun fileName(markdown: String): String =
        markdown
            .lineSequence()
            .first()
            .removePrefix("# ")
            .replace(Regex("[^\\p{L}\\p{N} ._-]"), "")
            .trim()
            .take(MAX_FILE_NAME)
            .ifEmpty { "gloss" }

    private companion object {
        const val MAX_FILE_NAME = 80
    }
}
