package com.rickphobia.ricknotes.revisionlog

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.logpdf.LogPdfWriteFailed
import com.rickphobia.ricknotes.core.logpdf.NothingToExport
import com.rickphobia.ricknotes.core.revisionlog.Entry
import com.rickphobia.ricknotes.core.revisionlog.RevisionLogSession
import com.rickphobia.ricknotes.logpdf.exportLogPdf
import com.rickphobia.ricknotes.logpdf.shareLogPdf
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

/** How the last export went, for the line beside the button. */
private enum class ExportOutcome { NOTHING_TO_EXPORT, FAILED }

/**
 * Export PDF: writes [entries] (the list as filtered and ordered on screen) to the course's PDF off
 * the main thread, with a spinner meanwhile, then opens the Share sheet; or says why it didn't.
 */
@Composable
internal fun ExportPdfButton(
    session: RevisionLogSession,
    courseFolder: File,
    entries: List<Entry>,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var exporting by remember(courseFolder) { mutableStateOf(false) }
    // Keyed by the list too, so a message about one filter goes when the filter changes.
    var outcome by remember(courseFolder, entries) { mutableStateOf<ExportOutcome?>(null) }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        OutlinedButton(
            enabled = !exporting,
            onClick = {
                exporting = true
                outcome = null
                scope.launch {
                    val pdf =
                        try {
                            withContext(Dispatchers.IO) { exportLogPdf(context, session, courseFolder, entries) }
                        } catch (_: NothingToExport) {
                            outcome = ExportOutcome.NOTHING_TO_EXPORT
                            null
                        } catch (_: LogPdfWriteFailed) {
                            // exportLogPdf has logged why.
                            outcome = ExportOutcome.FAILED
                            null
                        } finally {
                            exporting = false
                        }
                    pdf?.let { shareLogPdf(context, it) }
                }
            },
        ) { Text(stringResource(R.string.export_pdf)) }
        if (exporting) CircularProgressIndicator(modifier = Modifier.size(PROGRESS_SIZE))
        if (outcome == ExportOutcome.NOTHING_TO_EXPORT) Text(stringResource(R.string.export_pdf_nothing))
        if (outcome == ExportOutcome.FAILED) {
            Text(stringResource(R.string.export_pdf_failed), color = MaterialTheme.colorScheme.error)
        }
    }
}

private val PROGRESS_SIZE = 20.dp
