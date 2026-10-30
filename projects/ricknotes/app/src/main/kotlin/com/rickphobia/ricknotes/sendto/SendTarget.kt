package com.rickphobia.ricknotes.sendto

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.core.content.FileProvider
import com.rickphobia.ricknotes.core.presets.Preset
import com.rickphobia.ricknotes.logging.AppLog
import java.io.File

/** The AI apps a Document can be sent to, by their Android package. */
enum class SendTarget(
    val label: String,
    val packageName: String,
) {
    GEMINI("Gemini", "com.google.android.apps.bard"),
    CLAUDE("Claude", "com.anthropic.claude"),
}

/**
 * Puts [preset]'s prompt on the clipboard, then shares [pdfs] (one Document, or Both Panes with
 * the one Send to was opened from first) in one share to [target]'s app, beside RickNotes where the
 * tablet splits the screen; or through the full share menu when that app isn't installed. Each PDF
 * goes through a content URI from the FileProvider, readable only by the app it is shared to.
 */
fun sendTo(
    context: Context,
    pdfs: List<File>,
    target: SendTarget,
    preset: Preset,
) {
    // The prompt is the owner's text, and the names are their files: neither goes in the log.
    AppLog.i("send to: ${target.label}, Preset '${preset.name}', ${pdfs.size} Document(s)")
    val clipboard = context.getSystemService(ClipboardManager::class.java)
    clipboard.setPrimaryClip(ClipData.newPlainText(preset.name, preset.prompt))
    val share = shareIntent(pdfs.map { FileProvider.getUriForFile(context, "${context.packageName}.files", it) })
    val direct =
        Intent(share)
            .setPackage(target.packageName)
            // Best effort: Android splits the screen only on large screens from 12L, else opens full screen.
            .addFlags(Intent.FLAG_ACTIVITY_LAUNCH_ADJACENT or Intent.FLAG_ACTIVITY_NEW_TASK)
    val intent =
        if (isInstalled(context.packageManager, direct)) {
            direct
        } else {
            AppLog.i("send to: ${target.label} app not installed, showing the share menu")
            // The share menu is a sheet over RickNotes, so it goes without the split screen flags.
            Intent.createChooser(share, target.label)
        }
    try {
        context.startActivity(intent)
    } catch (e: ActivityNotFoundException) {
        AppLog.e("send to: no app took the PDF", e)
    }
}

/** `ACTION_SEND` for one PDF, `ACTION_SEND_MULTIPLE` for more, in the order of [uris]. */
private fun shareIntent(uris: List<Uri>): Intent {
    val share =
        if (uris.size == 1) {
            Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM, uris.single())
        } else {
            Intent(Intent.ACTION_SEND_MULTIPLE).putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(uris))
        }
    // Some apps read the PDFs from ClipData rather than EXTRA_STREAM; the read grant covers only these.
    share.clipData =
        ClipData.newRawUri(null, uris.first()).apply { uris.drop(1).forEach { addItem(ClipData.Item(it)) } }
    return share.setType(PDF_TYPE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
}

private fun isInstalled(
    packageManager: PackageManager,
    intent: Intent,
) = packageManager.queryIntentActivities(intent, 0).isNotEmpty()

private const val PDF_TYPE = "application/pdf"
