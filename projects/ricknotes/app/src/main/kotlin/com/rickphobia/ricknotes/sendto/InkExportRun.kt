package com.rickphobia.ricknotes.sendto

import android.content.Context
import android.widget.Toast
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
import com.rickphobia.ricknotes.core.presets.DocumentSend
import com.rickphobia.ricknotes.core.presets.Preset
import com.rickphobia.ricknotes.core.presets.PresetSend
import com.rickphobia.ricknotes.core.session.DocumentSnapshot
import com.rickphobia.ricknotes.export.ExportDocument
import com.rickphobia.ricknotes.export.ExportFailed
import com.rickphobia.ricknotes.export.ExportPurpose
import com.rickphobia.ricknotes.export.PictureMissing
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

/** Where Export with ink reads a Document from: its Pictures' [assetsFolder] and its ink's [snapshot]. */
class ExportSource(
    val assetsFolder: File,
    val snapshot: () -> DocumentSnapshot,
)

/** A Document of a Preset send: its PDF, and its [source] or null when its ink hasn't loaded. */
internal class SendDocument(
    val pdf: File,
    val source: ExportSource?,
)

/**
 * Exports with ink from the Send to menu, behind one progress dialog with Cancel: Export with ink
 * on its own (then the Share sheet), or a Preset send whose Documents go with their ink (then the
 * target app). It outlives the menu, which closes as the Export starts; leaving the Document
 * screen cancels it. A cancel or failure shares nothing.
 */
internal class InkExportRun(
    private val context: Context,
    private val scope: CoroutineScope,
) {
    private var state by mutableStateOf<ExportState?>(null)
    private var job: Job? = null

    /** Export with ink: shares the PDF as it is when there is no ink, or says why it can't. */
    fun start(
        pdf: File,
        assetsFolder: File,
        snapshot: DocumentSnapshot,
    ) {
        if (job?.isActive == true) return
        when (val plan = ExportPlan.of(snapshot, inkWanted = true)) {
            ExportPlan.Bare -> {
                AppLog.i("Export with ink: no ink, sharing the PDF as it is")
                sharePdf(context, pdf)
            }

            ExportPlan.InkUnreadable -> {
                refuse("Export with ink", "the Ink file can't be read", R.string.export_ink_unreadable)
            }

            ExportPlan.PickASideFirst -> {
                refuse("Export with ink", "a Conflict copy is waiting", R.string.export_pick_a_side)
            }

            is ExportPlan.WithInk -> {
                export(listOf(ExportDocument(pdf, assetsFolder, plan)), forSendTo = false) {
                    sharePdf(context, it.single())
                }
            }
        }
    }

    /**
     * Sends [documents] (one, or Both Panes with the one Send to was opened from first) with
     * [preset] to [target]: each with its ink when the Preset is ink on and it has some, else as it
     * is. Their ink is read now, so ink written afterwards doesn't go.
     */
    fun send(
        documents: List<SendDocument>,
        target: SendTarget,
        preset: Preset,
    ) {
        if (job?.isActive == true) return
        when (val plan = PresetSend.of(preset, documents.map { it.source?.snapshot?.invoke() })) {
            PresetSend.PickASideFirst -> {
                refuse("send to", "a Conflict copy is waiting", R.string.send_pick_a_side)
            }

            is PresetSend.Ready -> {
                sendReady(plan, documents, target, preset)
            }
        }
    }

    private fun sendReady(
        plan: PresetSend.Ready,
        documents: List<SendDocument>,
        target: SendTarget,
        preset: Preset,
    ) {
        if (plan.inkLeftOut) {
            AppLog.i("send to: ink left out, sending the PDF as it is")
            Toast.makeText(context, R.string.send_ink_left_out, Toast.LENGTH_LONG).show()
        }
        val pdfs = documents.map { it.pdf }
        val exports =
            plan.documents.zip(documents).mapNotNull { (send, document) ->
                val source = document.source
                if (send is DocumentSend.WithInk && source != null) {
                    ExportDocument(document.pdf, source.assetsFolder, send.plan)
                } else {
                    null
                }
            }
        if (exports.isEmpty()) {
            sendTo(context, pdfs, target, preset, inkWent = false)
            return
        }
        export(exports, forSendTo = true) { made ->
            val exported = exports.map { it.pdf }.zip(made).toMap()
            sendTo(context, pdfs.map { exported[it] ?: it }, target, preset, inkWent = true)
        }
    }

    private fun refuse(
        what: String,
        why: String,
        @StringRes message: Int,
    ) {
        AppLog.i("$what refused: $why")
        state = ExportState.Stopped(message)
    }

    // Makes every Export in order, each in its own cache subfolder, then hands them to [share].
    private fun export(
        exports: List<ExportDocument>,
        forSendTo: Boolean,
        share: (List<File>) -> Unit,
    ) {
        val pages = exports.sumOf { it.plan.pages.size }
        state = ExportState.Running(0, pages)
        job =
            scope.launch {
                try {
                    var before = 0
                    val made =
                        exports.mapIndexed { slot, export ->
                            val purpose = if (forSendTo) ExportPurpose.SendTo(slot) else ExportPurpose.ShareSheet
                            exportWithInk(context, export, purpose) { done ->
                                state = ExportState.Running(before + done, pages)
                            }.also { before += export.plan.pages.size }
                        }
                    state = null
                    share(made)
                } catch (e: CancellationException) {
                    state = ExportState.Stopped(R.string.export_cancelled)
                    throw e
                } catch (e: ExportFailed) {
                    // exportWithInk has logged the step and why.
                    val missingPicture = e.cause is PictureMissing
                    state =
                        ExportState.Stopped(
                            if (missingPicture) R.string.export_picture_missing else R.string.export_failed,
                        )
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
