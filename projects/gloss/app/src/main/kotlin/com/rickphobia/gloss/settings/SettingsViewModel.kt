package com.rickphobia.gloss.settings

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.rickphobia.gloss.ai.AnthropicClient
import com.rickphobia.gloss.core.ai.AiFailure
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** The Settings screen's state: whether a key is saved, and the key check in progress. */
class SettingsViewModel(
    private val apiKeys: ApiKeyStore,
    private val anthropic: AnthropicClient,
    startWithKeyEntry: Boolean,
) : ViewModel() {
    var hasKey by mutableStateOf(apiKeys.hasKey())
        private set

    /** The key box is shown on first run, and after Change key until a key is saved or it's cancelled. */
    var enteringKey by mutableStateOf(startWithKeyEntry || !hasKey)
        private set

    var checkingKey by mutableStateOf(false)
        private set

    /** Why the last key entered wasn't saved, or null. */
    var keyProblem: AiFailure? by mutableStateOf(null)
        private set

    fun changeKey() {
        enteringKey = true
        keyProblem = null
    }

    fun cancelKeyEntry() {
        if (hasKey) enteringKey = false
        keyProblem = null
    }

    /** Checks [entered] with Anthropic and saves it if accepted, then calls [onSaved]. */
    fun saveKey(
        entered: String,
        onSaved: () -> Unit,
    ) {
        val key = entered.trim()
        if (key.isEmpty() || checkingKey) return
        checkingKey = true
        keyProblem = null
        viewModelScope.launch {
            val problem = anthropic.checkKey(key)
            if (problem == null) {
                withContext(Dispatchers.IO) { apiKeys.save(key) }
                hasKey = true
                enteringKey = false
                onSaved()
            }
            keyProblem = problem
            checkingKey = false
        }
    }
}
