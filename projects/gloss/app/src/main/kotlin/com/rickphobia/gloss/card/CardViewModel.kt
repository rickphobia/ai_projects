package com.rickphobia.gloss.card

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.rickphobia.gloss.core.DefineResult
import com.rickphobia.gloss.core.Gloss
import com.rickphobia.gloss.core.Selection
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
            result = withContext(Dispatchers.IO) { gloss.define(selection) }
        }
    }
}
