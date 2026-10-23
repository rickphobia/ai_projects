package com.rickphobia.ricknotes.revisionlog

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.revisionlog.Entry
import com.rickphobia.ricknotes.core.revisionlog.EntryKind
import com.rickphobia.ricknotes.core.revisionlog.Redo
import com.rickphobia.ricknotes.core.revisionlog.RevisionLogSession
import com.rickphobia.ricknotes.ink.SavedRedo
import com.rickphobia.ricknotes.logging.AppLog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.text.DateFormat
import java.util.Date

/**
 * One Course folder's Revision log: its Entries newest first, filterable by kind, and one Entry at
 * a time. [onOpenDocument] opens an Entry's Document and says whether it was found.
 */
@Composable
fun RevisionLogScreen(
    courseFolder: File,
    onOpenDocument: (Entry) -> Boolean,
    onBack: () -> Unit,
) {
    val session by produceState<RevisionLogSession?>(null, courseFolder) {
        value = withContext(Dispatchers.IO) { RevisionLogSessions.open(courseFolder) }
    }
    var showing by remember(courseFolder) { mutableStateOf<Entry?>(null) }
    // Kept here, not in the list, so the filter is still set on coming back from an Entry.
    var kind by remember(courseFolder) { mutableStateOf<EntryKind?>(null) }
    BackHandler { if (showing != null) showing = null else onBack() }
    val current = session
    Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = { if (showing != null) showing = null else onBack() }) {
                Text(stringResource(R.string.back))
            }
            Text(
                stringResource(R.string.revision_log_of, courseFolder.name),
                style = MaterialTheme.typography.headlineSmall,
            )
        }
        if (current == null) return@Column
        RevisionLogWarnings(current)
        val entry = showing
        if (entry == null) {
            EntryList(current, kind, onFilter = { kind = it }, onShow = { showing = it })
        } else {
            EntryDetail(
                current,
                entry,
                onOpenDocument = { onOpenDocument(entry) },
                onChanged = { showing = current.entries.firstOrNull { it.id == entry.id } },
            )
        }
    }
}

@Composable
private fun RevisionLogWarnings(session: RevisionLogSession) {
    val error = MaterialTheme.colorScheme.error
    session.damaged?.let {
        Text(stringResource(R.string.revision_log_read_only, it.reason), color = error)
    }
    if (session.conflictCopies.isNotEmpty()) {
        Text(
            stringResource(R.string.revision_log_conflict, session.conflictCopies.joinToString()),
            color = error,
        )
    }
}

@Composable
private fun EntryList(
    session: RevisionLogSession,
    kind: EntryKind?,
    onFilter: (EntryKind?) -> Unit,
    onShow: (Entry) -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(vertical = 8.dp)) {
        listOf(
            null to R.string.all_entries,
            EntryKind.MISTAKE to R.string.mistakes,
            EntryKind.KEY_POINT to R.string.key_points,
        ).forEach { (option, label) ->
            FilterChip(
                selected = kind == option,
                onClick = { onFilter(option) },
                label = { Text(stringResource(label)) },
            )
        }
    }
    val entries = session.newestFirst(kind)
    if (entries.isEmpty()) {
        Text(stringResource(R.string.no_entries), modifier = Modifier.padding(top = 16.dp))
        return
    }
    LazyColumn {
        items(entries, key = { it.id.value }) { entry ->
            Column(modifier = Modifier.fillMaxWidth().clickable { onShow(entry) }.padding(vertical = 10.dp)) {
                Text(entryTitle(entry), style = MaterialTheme.typography.titleMedium)
                entry.why?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
            }
            HorizontalDivider()
        }
    }
}

@Composable
private fun EntryDetail(
    session: RevisionLogSession,
    entry: Entry,
    onOpenDocument: () -> Boolean,
    onChanged: () -> Unit,
) {
    var editing by remember(entry.id) { mutableStateOf(false) }
    var confirmingDelete by remember(entry.id) { mutableStateOf(false) }
    var documentMissing by remember(entry.id) { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
        Text(entryTitle(entry), style = MaterialTheme.typography.titleMedium)
        Text(
            stringResource(R.string.entry_source, entry.source.documentPath, entry.source.pageNumber),
            style = MaterialTheme.typography.bodyMedium,
        )
        entry.category?.let { Text(stringResource(it.label)) }
        entry.why?.let { Text(stringResource(R.string.entry_why, it)) }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(
                onClick = { documentMissing = !onOpenDocument() },
            ) { Text(stringResource(R.string.open_in_document)) }
            if (!session.readOnly) {
                TextButton(onClick = { editing = true }) { Text(stringResource(R.string.edit)) }
                TextButton(onClick = { confirmingDelete = true }) { Text(stringResource(R.string.delete_entry)) }
            }
        }
        if (documentMissing) Text(stringResource(R.string.document_not_found), color = MaterialTheme.colorScheme.error)
        if (entry.redos.isNotEmpty()) EarlierRedos(entry.redos)
        SnipPair(session, entry, modifier = Modifier.weight(1f))
    }
    if (editing) {
        EntryEditDialog(
            entry,
            onSave = { category, why ->
                session.edit(entry.id, category, why)
                editing = false
                onChanged()
            },
            onDismiss = { editing = false },
        )
    }
    if (confirmingDelete) {
        DeleteEntryDialog(
            onConfirm = {
                session.delete(entry.id)
                AppLog.i("deleted ${entry.kind} Entry ${entry.id.value} from the Revision log")
                confirmingDelete = false
                onChanged()
            },
            onDismiss = { confirmingDelete = false },
        )
    }
}

/** An Entry's Redos, newest first, each with the date it was written. */
@Composable
private fun EarlierRedos(redos: List<Redo>) {
    Text(stringResource(R.string.earlier_redos, redos.size), style = MaterialTheme.typography.labelLarge)
    Row(
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.horizontalScroll(rememberScrollState()),
    ) {
        redos.asReversed().forEach { redo ->
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(formatDate(redo.atMs), style = MaterialTheme.typography.labelMedium)
                SavedRedo(redo, Modifier.size(REDO_PREVIEW_WIDTH, REDO_PREVIEW_HEIGHT))
            }
        }
    }
}

private val REDO_PREVIEW_WIDTH = 240.dp
private val REDO_PREVIEW_HEIGHT = 160.dp

private fun formatDate(epochMs: Long): String = DateFormat.getDateInstance(DateFormat.MEDIUM).format(Date(epochMs))

@Composable
internal fun entryTitle(entry: Entry): String {
    val kind = stringResource(if (entry.kind == EntryKind.MISTAKE) R.string.edit_mistake else R.string.edit_key_point)
    val date = remember(entry.addedAtMs) { formatDate(entry.addedAtMs) }
    val name = entry.source.documentPath.substringAfterLast('/')
    return stringResource(R.string.entry_title, kind, name, entry.source.pageNumber, date)
}
