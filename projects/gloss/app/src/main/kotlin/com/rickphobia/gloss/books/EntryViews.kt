package com.rickphobia.gloss.books

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.rickphobia.gloss.R
import com.rickphobia.gloss.core.bookpage.LookupEntry
import com.rickphobia.gloss.core.bookpage.NoteEntry
import com.rickphobia.gloss.core.lookup.LookupKind

private const val ANSWER_PREVIEW_LINES = 3

/** Callbacks shared by the Book page and the Lookup screen. */
class EntryActions(
    val onOpenLookup: (Long) -> Unit,
    val onEditNote: (Long, String) -> Unit,
    val onDeleteNote: (Long) -> Unit,
    val onDeleteLookup: (Long) -> Unit,
)

/**
 * A Lookup in a list: its Selection, kind and the start of its answer; tapping it opens the whole
 * chat. [onDelete] is null where the Lookup can't be deleted (Recent, which doesn't list its Notes).
 */
@Composable
internal fun LookupRow(
    entry: LookupEntry,
    onOpen: () -> Unit,
    onDelete: ((LookupEntry) -> Unit)?,
    above: String? = null,
) {
    OutlinedCard(modifier = Modifier.fillMaxWidth().clickable(onClick = onOpen)) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            above?.let { SmallLine(it) }
            SelectionQuote(entry.lookup.selection)
            Text(
                text = entry.lookup.answer,
                style = MaterialTheme.typography.bodyMedium,
                maxLines = ANSWER_PREVIEW_LINES,
                overflow = TextOverflow.Ellipsis,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SmallLine(kindLabel(entry))
                if (onDelete != null) {
                    TextButton(onClick = { onDelete(entry) }) { Text(stringResource(R.string.delete)) }
                }
            }
        }
    }
}

@Composable
private fun kindLabel(entry: LookupEntry): String {
    val follows = entry.lookup.followUps.size
    return when (entry.lookup.kind) {
        LookupKind.Define -> stringResource(R.string.lookup_define)
        LookupKind.Explain -> pluralStringResource(R.plurals.lookup_explain, follows, follows)
    }
}

/** A Note with Edit and Delete; [quoteSelection] is off under its Lookup, which already shows it. */
@Composable
internal fun NoteRow(
    entry: NoteEntry,
    onEdit: (Long, String) -> Unit,
    onDelete: (Long) -> Unit,
    quoteSelection: Boolean = true,
    above: String? = null,
) {
    var editing by rememberSaveable { mutableStateOf(false) }
    var deleting by rememberSaveable { mutableStateOf(false) }
    Column(
        modifier = Modifier.fillMaxWidth().padding(start = 12.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        above?.let { SmallLine(it) }
        if (quoteSelection) SelectionQuote(entry.note.selection)
        SmallLine(stringResource(R.string.note_label))
        Text(text = entry.note.text, style = MaterialTheme.typography.bodyMedium)
        Row {
            TextButton(onClick = { editing = true }) { Text(stringResource(R.string.edit)) }
            TextButton(onClick = { deleting = true }) { Text(stringResource(R.string.delete)) }
        }
    }
    if (editing) {
        EditNoteDialog(entry.note.text, onSave = { onEdit(entry.id, it) }, onClose = { editing = false })
    }
    if (deleting) {
        ConfirmDelete(
            title = stringResource(R.string.delete_note_title),
            message = null,
            onConfirm = { onDelete(entry.id) },
            onClose = { deleting = false },
        )
    }
}

@Composable
private fun EditNoteDialog(
    original: String,
    onSave: (String) -> Unit,
    onClose: () -> Unit,
) {
    var text by rememberSaveable { mutableStateOf(original) }
    AlertDialog(
        onDismissRequest = onClose,
        title = { Text(stringResource(R.string.edit_note_title)) },
        text = {
            OutlinedTextField(
                value = text,
                onValueChange = { text = it },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
            )
        },
        confirmButton = {
            TextButton(onClick = {
                onSave(text)
                onClose()
            }, enabled = text.isNotBlank()) { Text(stringResource(R.string.save)) }
        },
        dismissButton = { TextButton(onClick = onClose) { Text(stringResource(R.string.cancel)) } },
    )
}

/** Asks before deleting a Lookup, saying how many Notes go with it. */
@Composable
internal fun ConfirmDeleteLookup(
    entry: LookupEntry,
    onConfirm: () -> Unit,
    onClose: () -> Unit,
) {
    val notes = entry.notes.size
    ConfirmDelete(
        title = stringResource(R.string.delete_lookup_title),
        message = if (notes > 0) pluralStringResource(R.plurals.delete_lookup_notes, notes, notes) else null,
        onConfirm = onConfirm,
        onClose = onClose,
    )
}

@Composable
private fun ConfirmDelete(
    title: String,
    message: String?,
    onConfirm: () -> Unit,
    onClose: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onClose,
        title = { Text(title) },
        text = message?.let { { Text(it) } },
        confirmButton = {
            TextButton(onClick = {
                onConfirm()
                onClose()
            }) { Text(stringResource(R.string.delete)) }
        },
        dismissButton = { TextButton(onClick = onClose) { Text(stringResource(R.string.cancel)) } },
    )
}

/** The Selection, set apart as a quote from the book. */
@Composable
internal fun SelectionQuote(selection: String) {
    Text(
        text = "“$selection”",
        style = MaterialTheme.typography.bodyLarge,
        fontStyle = FontStyle.Italic,
    )
}

@Composable
internal fun SmallLine(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

/** A heading in a list, such as a chapter's title. */
@Composable
internal fun Heading(text: String) {
    Text(text = text, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
}

/** Holds which Lookup is waiting for its delete to be confirmed. */
@Composable
internal fun rememberLookupToDelete() = remember { mutableStateOf<LookupEntry?>(null) }
