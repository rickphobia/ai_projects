package com.rickphobia.gloss.settings

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.rickphobia.gloss.ai.AnthropicClient
import com.rickphobia.gloss.core.ai.AiFailure
import com.rickphobia.gloss.core.context.Legado
import com.rickphobia.gloss.core.context.LegadoFailure
import com.rickphobia.gloss.core.context.LegadoReply
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Why a key entered on the Settings screen wasn't saved. */
enum class KeyProblem { Rejected, NoInternet, CheckFailed, NotStored }

/** Whether Gloss can reach Legado's web service right now. */
sealed interface LegadoStatus {
    data object Checking : LegadoStatus

    data object Reachable : LegadoStatus

    data class Unreachable(
        val failure: LegadoFailure,
    ) : LegadoStatus
}

/**
 * The Settings screen's state: whether a key is saved, the key check in progress, and whether
 * Legado's web service can be reached.
 */
class SettingsViewModel(
    private val apiKeys: ApiKeyStore,
    private val anthropic: AnthropicClient,
    private val legado: Legado,
    private val checkModel: String,
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
    var keyProblem: KeyProblem? by mutableStateOf(null)
        private set

    /** Set once a key entered on this screen is saved; the screen may then close. */
    var keySaved by mutableStateOf(false)
        private set

    var legadoStatus: LegadoStatus by mutableStateOf(LegadoStatus.Checking)
        private set

    private var legadoCheck: Job? = null

    /** Asks Legado for its bookshelf, as a Define does. The screen calls it each time it's shown. */
    fun checkLegado() {
        if (legadoCheck?.isActive == true) return
        legadoStatus = LegadoStatus.Checking
        legadoCheck =
            viewModelScope.launch {
                legadoStatus =
                    when (val reply = legado.bookshelf()) {
                        is LegadoReply.Ok -> LegadoStatus.Reachable
                        is LegadoReply.Failed -> LegadoStatus.Unreachable(reply.failure)
                    }
            }
    }

    fun changeKey() {
        enteringKey = true
        keyProblem = null
    }

    fun cancelKeyEntry() {
        if (hasKey) enteringKey = false
        keyProblem = null
    }

    /** Checks [entered] with Anthropic and saves it if accepted. */
    fun saveKey(entered: String) {
        val key = entered.trim()
        if (key.isEmpty() || checkingKey) return
        checkingKey = true
        keyProblem = null
        viewModelScope.launch {
            val problem =
                when (anthropic.checkKey(key, checkModel)) {
                    null -> if (withContext(Dispatchers.IO) { apiKeys.save(key) }) null else KeyProblem.NotStored
                    AiFailure.KeyRejected -> KeyProblem.Rejected
                    AiFailure.NoInternet -> KeyProblem.NoInternet
                    AiFailure.NoKey, AiFailure.AiError -> KeyProblem.CheckFailed
                }
            if (problem == null) {
                hasKey = true
                enteringKey = false
                keySaved = true
            }
            keyProblem = problem
            checkingKey = false
        }
    }
}
