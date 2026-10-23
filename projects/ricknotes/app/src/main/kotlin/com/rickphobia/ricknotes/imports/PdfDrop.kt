package com.rickphobia.ricknotes.imports

import android.app.Activity
import android.content.ClipDescription
import android.net.Uri
import android.provider.OpenableColumns
import android.view.DragEvent
import android.widget.Toast
import androidx.annotation.StringRes
import androidx.compose.ui.draganddrop.DragAndDropEvent
import androidx.compose.ui.draganddrop.DragAndDropTarget
import androidx.compose.ui.draganddrop.toAndroidDragEvent
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.studyfolder.PdfNotCopied
import com.rickphobia.ricknotes.core.studyfolder.copyPdfInto
import com.rickphobia.ricknotes.logging.AppLog
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.IOException
import java.util.UUID

private const val PDF_TYPE = "application/pdf"

// Every PDF starts with this; checked instead of trusting the type the other app gave.
private val PDF_HEADER = "%PDF-".toByteArray()

// Dropped content is read into here first, then copied into the Study folder and deleted.
private const val DROPS_FOLDER = "drops"

/** Whether a drag says it carries a PDF, so the page view can hand it here instead of placing a Picture. */
fun DragEvent.carriesPdf(): Boolean = clipDescription?.hasMimeType(PDF_TYPE) == true

/**
 * Takes a PDF dragged in from another app in split screen, copies it into [folder] (never
 * overwriting: see [copyPdfInto]) and passes the copy to [opened]. The original is only read.
 * Anything else dropped shows a message. Logs the type, size and whether the name clashed, never
 * the content or where it came from.
 */
class PdfDrop(
    private val activity: Activity,
    private val scope: CoroutineScope,
    private val folder: () -> File,
    private val opened: (File) -> Unit,
) : DragAndDropTarget {
    override fun onDrop(event: DragAndDropEvent): Boolean = drop(event.toAndroidDragEvent())

    /** Takes [drag] as a dropped PDF; false if it carries nothing to read. */
    fun drop(drag: DragEvent): Boolean {
        val uri =
            drag.clipData
                ?.takeIf { it.itemCount > 0 }
                ?.getItemAt(0)
                ?.uri
        if (uri == null) {
            AppLog.w("PDF drop refused: no content, types ${drag.clipDescription?.mimeTypesText()}")
            tell(R.string.pdf_drop_not_pdf)
            return false
        }
        // Lets this app read content from another app; it ends when released or the activity goes.
        val permissions = activity.requestDragAndDropPermissions(drag)
        val target = folder()
        scope.launch {
            val received = File(File(activity.cacheDir, DROPS_FOLDER), UUID.randomUUID().toString())
            try {
                val copied = withContext(Dispatchers.IO) { receive(uri, received, target) }
                opened(copied)
            } catch (e: PdfNotReceived) {
                AppLog.w("PDF drop not added: ${e.message}", e)
                tell(e.reason)
            } catch (e: PdfNotCopied) {
                AppLog.e("PDF drop not added", e)
                tell(R.string.pdf_drop_not_saved)
            } finally {
                permissions?.release()
                received.delete()
            }
        }
        return true
    }

    private fun receive(
        uri: Uri,
        received: File,
        folder: File,
    ): File {
        val bytes = read(uri, received)
        val header = received.inputStream().use { it.readNBytes(PDF_HEADER.size) }
        if (!header.contentEquals(PDF_HEADER)) {
            throw PdfNotReceived(R.string.pdf_drop_not_pdf, "dropped content ($bytes bytes) is not a PDF")
        }
        val copied = copyPdfInto(folder.toPath(), received.toPath(), displayName(uri))
        AppLog.i("copied a dropped PDF in: $bytes bytes, name clashed ${copied.nameClashed}")
        return copied.path.toFile()
    }

    // Returns how many bytes were copied.
    private fun read(
        uri: Uri,
        received: File,
    ): Long =
        try {
            received.parentFile?.mkdirs()
            val input =
                activity.contentResolver.openInputStream(uri) ?: throw IOException("the provider gave no stream")
            input.use { source -> received.outputStream().use { source.copyTo(it) } }
        } catch (e: IOException) {
            throw PdfNotReceived(R.string.pdf_drop_unreadable, "couldn't read the dropped content", e)
        } catch (e: SecurityException) {
            throw PdfNotReceived(R.string.pdf_drop_unreadable, "no permission to read the dropped content", e)
        }

    // The name the other app shows; blank if it gives none, and copyPdfInto picks one then.
    private fun displayName(uri: Uri): String =
        try {
            activity.contentResolver
                .query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
                ?.use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }
                .orEmpty()
        } catch (e: SecurityException) {
            AppLog.w("the dropped PDF's name couldn't be read, so it gets a plain one", e)
            ""
        }

    private fun tell(
        @StringRes message: Int,
    ) {
        Toast.makeText(activity, message, Toast.LENGTH_LONG).show()
    }
}

/** A dropped file that isn't a readable PDF; [reason] is the message the student sees. */
private class PdfNotReceived(
    @StringRes val reason: Int,
    message: String,
    cause: Throwable? = null,
) : Exception(message, cause)

private fun ClipDescription.mimeTypesText(): String = (0 until mimeTypeCount).joinToString { getMimeType(it) }
