package com.rickphobia.ricknotes.share

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import com.rickphobia.ricknotes.logging.AppLog
import java.io.File

/**
 * Opens the full Share sheet for [pdf], through a content URI only the app it goes to can read. Used
 * by the Log PDF export and Export with ink; [pdf] must be under a path in `res/xml/shared_files.xml`.
 */
internal fun sharePdf(
    context: Context,
    pdf: File,
) {
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", pdf)
    val share =
        Intent(Intent.ACTION_SEND)
            .setType(PDF_TYPE)
            .putExtra(Intent.EXTRA_STREAM, uri)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    // Some apps read the PDF from ClipData rather than EXTRA_STREAM.
    share.clipData = ClipData.newRawUri(pdf.name, uri)
    try {
        context.startActivity(Intent.createChooser(share, pdf.name))
    } catch (e: ActivityNotFoundException) {
        AppLog.e("share PDF: no app took the share", e)
    }
}

private const val PDF_TYPE = "application/pdf"
