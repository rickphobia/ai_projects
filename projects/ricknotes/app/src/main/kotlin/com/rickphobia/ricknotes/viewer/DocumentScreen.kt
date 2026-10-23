package com.rickphobia.ricknotes.viewer

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleStartEffect
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.ink.InkTool
import com.rickphobia.ricknotes.core.session.SaveStatus
import com.rickphobia.ricknotes.core.session.SessionWarning
import com.rickphobia.ricknotes.files.PdfEntry
import com.rickphobia.ricknotes.ink.DocumentInk
import com.rickphobia.ricknotes.ink.PenMode
import com.rickphobia.ricknotes.logging.AppLog
import com.rickphobia.ricknotes.revisionlog.rememberRevisionLogAdder
import com.rickphobia.ricknotes.toolbar.BackButton
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
 * A PDF dropped onto a page is copied into its folder and opened with [openPdf].
 * Tapping the pen in use in the toolbar moves on through the Favourite pens in [settings]; fingers
 * do what it says, and Entries go to the Revision log of its Course folder.
 */
@Composable
fun DocumentScreen(
    pdf: PdfEntry,
    positions: ReadingPositions,
    settings: DocumentSettings,
    openPdf: (PdfEntry) -> Unit,
    onBack: () -> Unit,
) {
    BackHandler(onBack = onBack)
    val favouritePens = settings.favouritePens
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
        DocumentTopBar(pdf.name, onBack) {
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
                        settings.fingerGestures,
                        rememberRevisionLogAdder(pdf, settings.course, pages, current.pageSizes, current.ink),
                        openDropped = { copy -> openPdf(PdfEntry(copy.path, pdf.folder, copy.name)) },
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

/** Back, the Document's name (cut short when it doesn't fit), then [tools]. */
@Composable
private fun DocumentTopBar(
    name: String,
    onBack: () -> Unit,
    tools: @Composable () -> Unit,
) {
    Row(modifier = Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
        BackButton(onBack)
        Text(
            text = name,
            style = MaterialTheme.typography.titleMedium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        tools()
    }
}

/** Undo and redo, and "Not saved" while the ink isn't. */
@Composable
private fun InkControls(ink: DocumentInk) {
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
