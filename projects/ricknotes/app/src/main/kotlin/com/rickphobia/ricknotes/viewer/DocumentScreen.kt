package com.rickphobia.ricknotes.viewer

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleStartEffect
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.ink.FavouritePens
import com.rickphobia.ricknotes.core.ink.InkTool
import com.rickphobia.ricknotes.core.session.SaveStatus
import com.rickphobia.ricknotes.core.session.SessionWarning
import com.rickphobia.ricknotes.files.PdfEntry
import com.rickphobia.ricknotes.ink.DocumentInk
import com.rickphobia.ricknotes.ink.PenMode
import com.rickphobia.ricknotes.logging.AppLog
import com.rickphobia.ricknotes.toolbar.PenKind
import com.rickphobia.ricknotes.toolbar.PenToolbar
import com.rickphobia.ricknotes.toolbar.UndoRedoButtons
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

private sealed interface Opening {
    data object InProgress : Opening

    data class Ready(
        val pageSizes: List<PageSize>,
        val ink: DocumentInk,
    ) : Opening

    data class Failed(
        val error: DocumentOpenException,
    ) : Opening
}

/**
 * One Document, scrolling continuously from page to page, reopened where it was left in [positions].
 * Tapping the pen in use in the toolbar moves on through [favouritePens].
 */
@Composable
fun DocumentScreen(
    pdf: PdfEntry,
    positions: ReadingPositions,
    favouritePens: FavouritePens,
    onBack: () -> Unit,
) {
    BackHandler(onBack = onBack)
    // Each Document opens with the first Favourite pen.
    val tool = remember(pdf.path) { mutableStateOf<InkTool>(InkTool.Pen(favouritePens.colours.first())) }
    val kind = remember(pdf.path) { mutableStateOf(PenKind.INK) }
    val pages = remember(pdf.path) { PdfPages(File(pdf.path)) }
    DisposableEffect(pages) { onDispose { pages.close() } }
    val opening by produceState<Opening>(Opening.InProgress, pages) {
        value =
            try {
                val sizes = pages.open()
                Opening.Ready(sizes, withContext(Dispatchers.IO) { DocumentInk.open(File(pdf.path), sizes.size) })
            } catch (e: DocumentOpenException) {
                AppLog.w("opening a Document failed: ${e.message}", e)
                Opening.Failed(e)
            }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(modifier = Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onBack) { Text(stringResource(R.string.back)) }
            Text(text = pdf.name, style = MaterialTheme.typography.titleMedium)
            Spacer(modifier = Modifier.weight(1f))
            PenToolbar(tool, kind, favouritePens)
            (opening as? Opening.Ready)?.let { InkControls(it.ink) }
        }
        when (val current = opening) {
            Opening.InProgress -> {
                Text(stringResource(R.string.opening_document), modifier = Modifier.padding(24.dp))
            }

            is Opening.Failed -> {
                Text(
                    text = current.error.message.orEmpty(),
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.padding(24.dp),
                )
            }

            is Opening.Ready -> {
                SaveWhenLeaving(current.ink)
                // A Lasso selection only lasts while the Lasso is picked.
                LaunchedEffect(current.ink, kind.value) { if (kind.value != PenKind.LASSO) current.ink.lasso.clear() }
                current.ink.warnings.forEach { InkWarning(it) }
                PageList(
                    OpenDocument(
                        pages,
                        current.pageSizes,
                        pdf.path,
                        positions,
                        current.ink,
                    ) {
                        when (kind.value) {
                            PenKind.INK -> PenMode.Draw(tool.value)
                            PenKind.ERASER -> PenMode.Erase
                            PenKind.LASSO -> PenMode.Lasso
                        }
                    },
                )
            }
        }
    }
}

/** Delete while there is a Lasso selection, undo and redo, and "Not saved" while the ink isn't. */
@Composable
private fun InkControls(ink: DocumentInk) {
    if (ink.lasso.selection != null) {
        TextButton(onClick = ink.lasso::delete) { Text(stringResource(R.string.delete_selection)) }
    }
    UndoRedoButtons(ink.canUndo, ink.canRedo, ink::undo, ink::redo)
    if (ink.saveStatus == SaveStatus.FAILED) {
        Text(
            text = stringResource(R.string.not_saved),
            color = MaterialTheme.colorScheme.error,
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(horizontal = 16.dp),
        )
    }
}

/** Saves the ink when the app goes to the background, and once more when the Document closes. */
@Composable
private fun SaveWhenLeaving(ink: DocumentInk) {
    LifecycleStartEffect(ink) { onStopOrDispose { ink.saveInBackground() } }
    DisposableEffect(ink) { onDispose { ink.close() } }
}

@Composable
private fun InkWarning(warning: SessionWarning) {
    val text =
        when (warning) {
            is SessionWarning.InkFileUnreadable -> {
                stringResource(R.string.ink_file_unreadable, warning.error.fileName, warning.error.reason)
            }

            is SessionWarning.PdfPageCountChanged -> {
                stringResource(R.string.pdf_page_count_changed, warning.recordedPages, warning.nowPages)
            }
        }
    Text(
        text = text,
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodyMedium,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
    )
}
