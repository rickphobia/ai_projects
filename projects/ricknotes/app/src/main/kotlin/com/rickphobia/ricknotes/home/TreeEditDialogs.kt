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
import com.rickphobia.ricknotes.core.ink.PageBackground
import com.rickphobia.ricknotes.core.studyfolder.TreeNode
import com.rickphobia.ricknotes.viewer.label

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

    /** New Notebook made from the folder [folder]: asks for its background. */
    data class NewNotebook(
        val folder: String,
    ) : TreeEditDialog

    /** The new Notebook [notebook] is made: offers a new name, then opens it either way. */
    data class NameNotebook(
        val notebook: TreeNode.Document,
    ) : TreeEditDialog

    /** Link to PDF… for [orphan], offering [candidates] (tree paths of its folder's PDFs without ink). */
    data class LinkToPdf(
        val orphan: TreeNode.OrphanedInk,
        val candidates: List<String>,
    ) : TreeEditDialog
}

/**
 * What the New Notebook dialogs do: [create] makes one from a folder with a background, and
 * [name] opens the new Notebook, renamed first when the name given differs.
 */
class NotebookActions(
    val create: (folder: String, background: PageBackground) -> Unit,
    val name: (notebook: TreeNode.Document, name: String) -> Unit,
)

/** Shows [dialog]; [onEdit] gets the edit it asks for, and [onDismiss] closes it. */
@Composable
fun TreeEditDialogs(
    dialog: TreeEditDialog,
    tree: TreeNode.Folder,
    notebooks: NotebookActions,
    onEdit: (TreeEdit) -> Unit,
    onDismiss: () -> Unit,
) {
    when (dialog) {
        is TreeEditDialog.NewNotebook -> {
            BackgroundDialog(dialog.folder, onPick = { notebooks.create(dialog.folder, it) }, onDismiss = onDismiss)
        }

        is TreeEditDialog.NameNotebook -> {
            NameNotebookDialog(dialog.notebook, notebooks)
        }

        is TreeEditDialog.NewFolder -> {
            NameDialog(
                labels =
                    NameDialogLabels(
                        stringResource(R.string.new_folder_in, folderLabel(dialog.parent)),
                        stringResource(R.string.create),
                    ),
                initial = "",
                onName = { onEdit(TreeEdit.NewFolder(dialog.parent, it)) },
                onDismiss = onDismiss,
            )
        }

        is TreeEditDialog.Rename -> {
            NameDialog(
                labels =
                    NameDialogLabels(
                        stringResource(R.string.rename_title, dialog.node.name),
                        stringResource(R.string.rename),
                    ),
                initial = dialog.node.name,
                onName = { onEdit(TreeEdit.Rename(dialog.node, it)) },
                onDismiss = onDismiss,
            )
        }

        is TreeEditDialog.MoveTo -> {
            MoveToDialog(dialog.node, tree, onMove = { onEdit(TreeEdit.Move(dialog.node, it)) }, onDismiss = onDismiss)
        }

        is TreeEditDialog.LinkToPdf -> {
            LinkToPdfDialog(dialog, onLink = { onEdit(TreeEdit.LinkInk(dialog.orphan, it)) }, onDismiss = onDismiss)
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

/** A name dialog's [title] and button labels; with no [dismiss], its dismiss button says Cancel. */
private class NameDialogLabels(
    val title: String,
    val confirm: String,
    val dismiss: String? = null,
)

/** Asks for a name, starting from [initial] with its name before `.pdf` selected, ready to type over. */
@Composable
private fun NameDialog(
    labels: NameDialogLabels,
    initial: String,
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
        title = { Text(labels.title) },
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
        confirmButton = { TextButton(onClick = { submit() }, enabled = usable) { Text(labels.confirm) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(labels.dismiss ?: stringResource(R.string.cancel)) } },
    )
    LaunchedEffect(Unit) { focus.requestFocus() }
}

// Dismissing still opens it under the name it was given: it is made already.
@Composable
private fun NameNotebookDialog(
    notebook: TreeNode.Document,
    notebooks: NotebookActions,
) {
    NameDialog(
        labels =
            NameDialogLabels(
                stringResource(R.string.notebook_made),
                stringResource(R.string.open),
                stringResource(R.string.keep_name),
            ),
        initial = notebook.name,
        onName = { notebooks.name(notebook, it) },
        onDismiss = { notebooks.name(notebook, notebook.name) },
    )
}

/** Asks which background a new Notebook made from [folder] gets; tapping one makes it. */
@Composable
private fun BackgroundDialog(
    folder: String,
    onPick: (PageBackground) -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.new_notebook_in, folderLabel(folder))) },
        text = {
            Column {
                PageBackground.entries.forEach { background ->
                    Text(
                        text = stringResource(background.label()),
                        style = MaterialTheme.typography.bodyLarge,
                        modifier = Modifier.fillMaxWidth().clickable { onPick(background) }.padding(vertical = 12.dp),
                    )
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } },
    )
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

/** Lists the PDFs [dialog] offers; tapping one links the Orphaned ink to it. */
@Composable
private fun LinkToPdfDialog(
    dialog: TreeEditDialog.LinkToPdf,
    onLink: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.link_title, dialog.orphan.name)) },
        text = {
            if (dialog.candidates.isEmpty()) {
                Text(stringResource(R.string.link_no_pdfs))
            } else {
                LazyColumn(modifier = Modifier.fillMaxWidth().heightIn(max = PICKER_MAX_HEIGHT)) {
                    items(dialog.candidates, key = { it }) { pdf ->
                        Text(
                            text = pdf.substringAfterLast('/'),
                            style = MaterialTheme.typography.bodyLarge,
                            modifier = Modifier.fillMaxWidth().clickable { onLink(pdf) }.padding(vertical = 12.dp),
                        )
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } },
    )
}

private fun TreeNode.Folder.find(path: String): TreeNode.Folder? =
    if (this.path == path) {
        this
    } else {
        children.filterIsInstance<TreeNode.Folder>().firstNotNullOfOrNull { it.find(path) }
    }
