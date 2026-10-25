package com.rickphobia.gloss.card

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.rickphobia.gloss.core.DefineResult
import com.rickphobia.gloss.core.Gloss
import com.rickphobia.gloss.core.Selection
import com.rickphobia.gloss.core.context.BookContextResult
import com.rickphobia.gloss.logging.RollingLog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Runs the Define for one card. It outlives a screen rotation, so turning the phone doesn't pay
 * for a second call.
 */
class CardViewModel(
    private val gloss: Gloss,
    val selection: Selection,
    private val log: RollingLog,
) : ViewModel() {
    /** The answer or failure, or null while the AI is answering. */
    var result: DefineResult? by mutableStateOf(null)
        private set

    init {
        define()
    }

    fun retry() {
        if (result != null) define()
    }

    private fun define() {
        result = null
        viewModelScope.launch {
            val defined = withContext(Dispatchers.IO) { gloss.define(selection) }
            if (defined is DefineResult.Answer) logBookContext(defined.context)
            result = defined
        }
    }

    /** Whether the answer had Book context, and why not: never the book, the passage or the Selection. */
    private fun logBookContext(context: BookContextResult) {
        when (context) {
            is BookContextResult.Found -> {
                log.info(
                    "book context: found, passage_chars=${context.bookContext.passage.length}",
                )
            }

            is BookContextResult.Missing -> {
                log.info("book context: none, reason=${context.reason}")
            }
        }
    }
}
