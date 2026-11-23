package com.rickphobia.ricknotes.sendto

import android.content.Context
import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogProperties
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.export.ExportPlan
import com.rickphobia.ricknotes.core.session.DocumentSnapshot
import com.rickphobia.ricknotes.export.ExportFailed
import com.rickphobia.ricknotes.export.exportWithInk
import com.rickphobia.ricknotes.logging.AppLog
import com.rickphobia.ricknotes.share.sharePdf
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import java.io.File
import kotlin.coroutines.cancellation.CancellationException

/** Where an Export with ink is, for its dialog. */
private sealed interface ExportState {
    data class Running(
        val pagesDone: Int,
        val pages: Int,
    ) : ExportState

    /** Refused, failed or cancelled: nothing was shared, and [message] says why. */
    data class Stopped(
        @param:StringRes val message: Int,
    ) : ExportState
}

/**
 * Export with ink from the Send to menu: plans the Export from a snapshot of the Document's ink,
 * then shares the PDF as it is (no ink), makes the Export behind a progress dialog with Cancel and
 * shares it, or says why it can't. It outlives the menu, which closes as the Export starts; leaving
 * the Document screen cancels it.
 */
internal class InkExportRun(
    private val context: Context,
    private val scope: CoroutineScope,
) {
    private var state by mutableStateOf<ExportState?>(null)
    private var job: Job? = null

    fun start(
        pdf: File,
        snapshot: DocumentSnapshot,
    ) {
        if (job?.isActive == true) return
        when (val plan = ExportPlan.of(snapshot, inkWanted = true)) {
            ExportPlan.Bare -> {
                AppLog.i("Export with ink: no ink, sharing the PDF as it is")
                sharePdf(context, pdf)
            }

            ExportPlan.InkUnreadable -> {
                refuse("the Ink file can't be read", R.string.export_ink_unreadable)
            }

            ExportPlan.PickASideFirst -> {
                refuse("a Conflict copy is waiting", R.string.export_pick_a_side)
            }

            is ExportPlan.WithInk -> {
                export(pdf, plan)
            }
        }
    }

    private fun refuse(
        why: String,
        @StringRes message: Int,
    ) {
        AppLog.i("Export with ink refused: $why")
        state = ExportState.Stopped(message)
    }

    private fun export(
        pdf: File,
        plan: ExportPlan.WithInk,
    ) {
        val pages = plan.pages.size
        state = ExportState.Running(0, pages)
        job =
            scope.launch {
                try {
                    val export = exportWithInk(context, pdf, plan) { done -> state = ExportState.Running(done, pages) }
                    state = null
                    sharePdf(context, export)
                } catch (e: CancellationException) {
                    state = ExportState.Stopped(R.string.export_cancelled)
                    throw e
                } catch (_: ExportFailed) {
                    // exportWithInk has logged the step and why.
                    state = ExportState.Stopped(R.string.export_failed)
                }
            }
    }

    fun cancel() {
        job?.cancel()
    }

    fun dismiss() {
        state = null
    }

    /** The progress dialog with Cancel while an Export runs, then why it stopped; nothing otherwise. */
    @Composable
    fun Dialog() {
        when (val current = state) {
            null -> Unit
            is ExportState.Running -> ProgressDialog(current, ::cancel)
            is ExportState.Stopped -> StoppedDialog(current.message, ::dismiss)
        }
    }
}

@Composable
internal fun rememberInkExportRun(): InkExportRun {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    return remember(context, scope) { InkExportRun(context, scope) }
}

@Composable
private fun ProgressDialog(
    running: ExportState.Running,
    cancel: () -> Unit,
) {
    AlertDialog(
        // Only Cancel stops it: a tap beside the dialog must not leave an Export running unseen.
        onDismissRequest = {},
        properties = DialogProperties(dismissOnBackPress = false, dismissOnClickOutside = false),
        title = { Text(stringResource(R.string.export_with_ink)) },
        text = {
            Column {
                LinearProgressIndicator(
                    progress = { if (running.pages == 0) 0f else running.pagesDone.toFloat() / running.pages },
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                Text(stringResource(R.string.export_progress, running.pagesDone, running.pages))
            }
        },
        confirmButton = { TextButton(onClick = cancel) { Text(stringResource(R.string.export_cancel)) } },
    )
}

@Composable
private fun StoppedDialog(
    @StringRes message: Int,
    dismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = dismiss,
        title = { Text(stringResource(R.string.export_with_ink)) },
        text = { Text(stringResource(message)) },
        confirmButton = { TextButton(onClick = dismiss) { Text(stringResource(android.R.string.ok)) } },
    )
}
