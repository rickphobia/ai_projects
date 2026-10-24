package com.rickphobia.ricknotes.home

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import com.rickphobia.ricknotes.core.studyfolder.TreeEdits
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.nio.file.Path

/**
 * The home screen's tree edits: the [dialog] open, if any, and [generation], which counts the
 * edits run so the tree is listed again after each.
 */
class TreeEditState(
    private val edits: TreeEdits,
    private val hooks: TreeEditHooks,
    private val scope: CoroutineScope,
) {
    var dialog by mutableStateOf<TreeEditDialog?>(null)
    var generation by mutableIntStateOf(0)
        private set

    val menu =
        TreeEditMenu(
            newFolder = { dialog = TreeEditDialog.NewFolder(it) },
            rename = { dialog = TreeEditDialog.Rename(it) },
            moveTo = { dialog = TreeEditDialog.MoveTo(it) },
        )

    /** Runs [edit] off the main thread, then lets the rest of the app follow it or says why not. */
    fun run(edit: TreeEdit) {
        dialog = null
        scope.launch {
            val outcome = withContext(Dispatchers.IO) { runTreeEdit(edits, edit) }
            when (outcome) {
                is TreeEditOutcome.Done -> outcome.from?.let { hooks.followed(it, outcome.to, outcome.documents) }
                is TreeEditOutcome.NotDone -> dialog = TreeEditDialog.NotDone(outcome)
            }
            // Listed again even when not done: a failure may have left something under its new name.
            generation++
        }
    }
}

@Composable
fun rememberTreeEditState(
    studyFolder: String,
    hooks: TreeEditHooks,
): TreeEditState {
    val scope = rememberCoroutineScope()
    return remember(studyFolder) { TreeEditState(TreeEdits(Path.of(studyFolder), hooks.stillSaving), hooks, scope) }
}
