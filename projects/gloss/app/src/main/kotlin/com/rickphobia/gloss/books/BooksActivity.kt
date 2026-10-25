package com.rickphobia.gloss.books

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.rickphobia.gloss.GlossApplication
import com.rickphobia.gloss.card.GlossTheme
import com.rickphobia.gloss.settings.PhoneSettings
import com.rickphobia.gloss.settings.SettingsActivity

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
                        BookPageScreen(place.summary, books.page, actions, onBack = { books.back() })
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
}
