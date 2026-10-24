package com.rickphobia.ricknotes.sendto

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
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
 * Puts [preset]'s prompt on the clipboard, then shares [pdf] to [target]'s app, or through the
 * full share menu when that app isn't installed. The PDF goes through a content URI from the
 * FileProvider, readable only by the app it is shared to.
 */
fun sendTo(
    context: Context,
    pdf: File,
    target: SendTarget,
    preset: Preset,
) {
    // The prompt is the owner's text: it never goes in the log.
    AppLog.i("send to: ${target.label}, Preset '${preset.name}'")
    val clipboard = context.getSystemService(ClipboardManager::class.java)
    clipboard.setPrimaryClip(ClipData.newPlainText(preset.name, preset.prompt))
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", pdf)
    val share =
        Intent(Intent.ACTION_SEND)
            .setType(PDF_TYPE)
            .putExtra(Intent.EXTRA_STREAM, uri)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    // Some apps read the PDF from ClipData rather than EXTRA_STREAM.
    share.clipData = ClipData.newRawUri(pdf.name, uri)
    val direct = Intent(share).setPackage(target.packageName)
    val intent =
        if (isInstalled(context.packageManager, direct)) {
            direct
        } else {
            AppLog.i("send to: ${target.label} app not installed, showing the share menu")
            Intent.createChooser(share, target.label)
        }
    try {
        context.startActivity(intent)
    } catch (e: ActivityNotFoundException) {
        AppLog.e("send to: no app took the PDF", e)
    }
}

private fun isInstalled(
    packageManager: PackageManager,
    intent: Intent,
) = packageManager.queryIntentActivities(intent, 0).isNotEmpty()

private const val PDF_TYPE = "application/pdf"
