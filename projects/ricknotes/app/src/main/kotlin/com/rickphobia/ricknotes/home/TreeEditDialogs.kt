package com.rickphobia.ricknotes.home

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.studyfolder.TreeNode

private val PICKER_MAX_HEIGHT = 360.dp
private const val PDF_EXTENSION = ".pdf"

/** Which dialog a tree edit has open. */
sealed interface TreeEditDialog {
    data class NewFolder(
        val parent: String,
    ) : TreeEditDialog

    data class Rename(
        val node: TreeNode,
    ) : TreeEditDialog

    data class MoveTo(
        val node: TreeNode,
    ) : TreeEditDialog

    data class NotDone(
        val outcome: TreeEditOutcome.NotDone,
    ) : TreeEditDialog
}

/** Shows [dialog]; [onEdit] gets the edit it asks for, and [onDismiss] closes it. */
@Composable
fun TreeEditDialogs(
    dialog: TreeEditDialog,
    tree: TreeNode.Folder,
    onEdit: (TreeEdit) -> Unit,
    onDismiss: () -> Unit,
) {
    when (dialog) {
        is TreeEditDialog.NewFolder -> {
            NameDialog(
                title = stringResource(R.string.new_folder_in, folderLabel(dialog.parent)),
                initial = "",
                confirm = stringResource(R.string.create),
                onName = { onEdit(TreeEdit.NewFolder(dialog.parent, it)) },
                onDismiss = onDismiss,
            )
        }

        is TreeEditDialog.Rename -> {
            NameDialog(
                title = stringResource(R.string.rename_title, dialog.node.name),
                initial = dialog.node.name,
                confirm = stringResource(R.string.rename),
                onName = { onEdit(TreeEdit.Rename(dialog.node, it)) },
                onDismiss = onDismiss,
            )
        }

        is TreeEditDialog.MoveTo -> {
            MoveToDialog(dialog.node, tree, onMove = { onEdit(TreeEdit.Move(dialog.node, it)) }, onDismiss = onDismiss)
        }

        is TreeEditDialog.NotDone -> {
            val title = if (dialog.outcome.partly) R.string.tree_edit_partly_undone else R.string.tree_edit_not_done
            AlertDialog(
                onDismissRequest = onDismiss,
                title = { Text(stringResource(title)) },
                text = { Text(dialog.outcome.message.replaceFirstChar { it.uppercase() }) },
                confirmButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.ok)) } },
            )
        }
    }
}

@Composable
private fun folderLabel(path: String) =
    path.substringAfterLast('/').ifEmpty { stringResource(R.string.tree_study_folder_top) }

/** Asks for a name, starting from [initial] with its name before `.pdf` selected, ready to type over. */
@Composable
private fun NameDialog(
    title: String,
    initial: String,
    confirm: String,
    onName: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val base =
        if (initial.endsWith(
                PDF_EXTENSION,
                ignoreCase = true,
            )
        ) {
            initial.length - PDF_EXTENSION.length
        } else {
            initial.length
        }
    var typed by remember { mutableStateOf(TextFieldValue(initial, TextRange(0, base))) }
    val focus = remember { FocusRequester() }
    val usable = typed.text.isNotBlank()
    val submit = { if (usable) onName(typed.text) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            OutlinedTextField(
                value = typed,
                onValueChange = { typed = it },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { submit() }),
                modifier = Modifier.focusRequester(focus),
            )
        },
        confirmButton = { TextButton(onClick = { submit() }, enabled = usable) { Text(confirm) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } },
    )
    LaunchedEffect(Unit) { focus.requestFocus() }
}

/**
 * The Move to… folder picker over [tree], opening on [node]'s own folder: tap a folder to go into
 * it, Up to go back, Move here to move. A folder being moved isn't offered as a place to go.
 */
@Composable
private fun MoveToDialog(
    node: TreeNode,
    tree: TreeNode.Folder,
    onMove: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val from = node.path.substringBeforeLast('/', missingDelimiterValue = "")
    var path by remember { mutableStateOf(from) }
    val folder = tree.find(path) ?: tree
    val places = folder.children.filterIsInstance<TreeNode.Folder>().filter { it.path != node.path }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.move_title, node.name)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    folder.path.ifEmpty {
                        stringResource(R.string.tree_study_folder_top)
                    },
                    style = MaterialTheme.typography.titleMedium,
                )
                if (folder.path.isNotEmpty()) {
                    TextButton(onClick = { path = folder.path.substringBeforeLast('/', missingDelimiterValue = "") }) {
                        Text(stringResource(R.string.folder_up))
                    }
                }
                LazyColumn(modifier = Modifier.fillMaxWidth().heightIn(max = PICKER_MAX_HEIGHT)) {
                    items(places, key = { it.path }) { place ->
                        Text(
                            text = place.name,
                            style = MaterialTheme.typography.bodyLarge,
                            modifier =
                                Modifier.fillMaxWidth().clickable { path = place.path }.padding(
                                    vertical = 12.dp,
                                ),
                        )
                    }
                }
            }
        },
        // Moving to where it already is would only be refused.
        confirmButton = {
            TextButton(onClick = { onMove(folder.path) }, enabled = folder.path != from) {
                Text(stringResource(R.string.move_here))
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } },
    )
}

private fun TreeNode.Folder.find(path: String): TreeNode.Folder? =
    if (this.path == path) {
        this
    } else {
        children.filterIsInstance<TreeNode.Folder>().firstNotNullOfOrNull { it.find(path) }
    }
