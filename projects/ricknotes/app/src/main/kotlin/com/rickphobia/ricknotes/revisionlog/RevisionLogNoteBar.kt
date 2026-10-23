package com.rickphobia.ricknotes.revisionlog

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleStartEffect
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.revisionlog.Entry
import com.rickphobia.ricknotes.core.revisionlog.EntryKind
import com.rickphobia.ricknotes.core.revisionlog.MistakeCategory
import kotlinx.coroutines.delay

// Long enough to reach for Edit, short enough not to sit over the page.
private const val ADDED_NOTE_MS = 8_000L
private val NOTE_MAX_WIDTH = 560.dp

/**
 * The note about the last Add mistake or Add key point of [adder], with Edit for the Entry just
 * added. Also saves every Revision log when the app goes to the background.
 */
@Composable
internal fun RevisionLogNoteBar(
    adder: RevisionLogAdder,
    modifier: Modifier = Modifier,
) {
    LifecycleStartEffect(adder) { onStopOrDispose { RevisionLogSessions.saveAllInBackground() } }
    var editing by remember(adder) { mutableStateOf(false) }
    val note = adder.note ?: return
    if (note is RevisionLogNote.Added && !editing) {
        LaunchedEffect(note) {
            delay(ADDED_NOTE_MS)
            adder.dismiss()
        }
    }
    Surface(
        shape = MaterialTheme.shapes.medium,
        tonalElevation = 3.dp,
        shadowElevation = 3.dp,
        modifier = modifier.widthIn(max = NOTE_MAX_WIDTH),
    ) {
        Row(modifier = Modifier.padding(start = 16.dp, end = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(
                noteText(note),
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.weight(1f, fill = false),
            )
            when (note) {
                is RevisionLogNote.Adding -> {}

                is RevisionLogNote.Added -> {
                    TextButton(onClick = { editing = true }) { Text(stringResource(R.string.edit)) }
                }

                else -> {
                    TextButton(onClick = adder::dismiss) { Text(stringResource(R.string.ok)) }
                }
            }
        }
    }
    if (note is RevisionLogNote.Added && editing) {
        EntryEditDialog(
            note.entry,
            onSave = { category, why ->
                adder.edit(category, why)
                editing = false
            },
            onDismiss = { editing = false },
        )
    }
}

@Composable
private fun noteText(note: RevisionLogNote): String =
    when (note) {
        is RevisionLogNote.Adding -> {
            stringResource(R.string.adding_to_course, note.courseName)
        }

        is RevisionLogNote.Added -> {
            stringResource(R.string.added_to_course, note.courseName)
        }

        RevisionLogNote.NoCourseFolder -> {
            stringResource(R.string.no_course_folder)
        }

        is RevisionLogNote.LogUnreadable -> {
            stringResource(
                R.string.revision_log_unreadable,
                note.courseName,
                note.reason,
            )
        }

        is RevisionLogNote.Failed -> {
            stringResource(R.string.entry_not_added, note.courseName)
        }
    }

/** Picks a Mistake's category (Key points have none) and writes its one-line "why". */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun EntryEditDialog(
    entry: Entry,
    onSave: (MistakeCategory?, String?) -> Unit,
    onDismiss: () -> Unit,
) {
    var category by remember(entry.id) { mutableStateOf(entry.category) }
    var why by remember(entry.id) { mutableStateOf(entry.why.orEmpty()) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                stringResource(
                    if (entry.kind ==
                        EntryKind.MISTAKE
                    ) {
                        R.string.edit_mistake
                    } else {
                        R.string.edit_key_point
                    },
                ),
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (entry.kind == EntryKind.MISTAKE) {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        MistakeCategory.entries.forEach { option ->
                            FilterChip(
                                selected = category == option,
                                // Tapping the picked category again clears it: the category is optional.
                                onClick = { category = option.takeIf { it != category } },
                                label = { Text(stringResource(option.label)) },
                            )
                        }
                    }
                }
                OutlinedTextField(
                    value = why,
                    onValueChange = { why = it.replace('\n', ' ') },
                    label = { Text(stringResource(R.string.why)) },
                    singleLine = true,
                )
            }
        },
        confirmButton = { TextButton(onClick = { onSave(category, why) }) { Text(stringResource(R.string.save)) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } },
    )
}

@get:StringRes
internal val MistakeCategory.label: Int
    get() =
        when (this) {
            MistakeCategory.CONCEPT -> R.string.category_concept
            MistakeCategory.ALGEBRA -> R.string.category_algebra
            MistakeCategory.CARELESS -> R.string.category_careless
            MistakeCategory.MISREAD -> R.string.category_misread
            MistakeCategory.DIDNT_UNDERSTAND -> R.string.category_didnt_understand
        }
