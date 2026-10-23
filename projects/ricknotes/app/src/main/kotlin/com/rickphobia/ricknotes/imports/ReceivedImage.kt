package com.rickphobia.ricknotes.imports

import android.content.ContentResolver
import android.graphics.BitmapFactory
import android.net.Uri
import com.rickphobia.ricknotes.logging.AppLog
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream

/** Image types that can become a Picture, with the extension their copy in `.assets` gets. */
private val PICTURE_TYPES = mapOf("image/png" to "png", "image/jpeg" to "jpg", "image/webp" to "webp")

// Far past any screenshot; a bigger file is almost certainly not meant as a Picture.
private const val MAX_IMAGE_BYTES = 50L * 1024 * 1024

/** Why a dropped or shared file didn't become a Picture. */
enum class ImageProblem {
    /** Nothing that could be read came with it, or reading it failed. */
    UNREADABLE,

    /** It was read, but isn't a PNG, JPEG or WebP image. */
    NOT_AN_IMAGE,

    /** It is bigger than [MAX_IMAGE_BYTES]. */
    TOO_BIG,
}

/** A dropped or shared file that can't be placed as a Picture. */
class ImageNotReceived(
    val problem: ImageProblem,
    message: String,
    cause: Throwable? = null,
) : Exception(message, cause)

/** An image read into the app's own [file], ready to place: [extension] matches its real type. */
class ReceivedImage(
    val file: File,
    val extension: String,
    val widthPx: Int,
    val heightPx: Int,
)

/**
 * Reads the content at [uri] into [target] and checks it is a PNG, JPEG or WebP image by decoding
 * its header, not by trusting the type the other app gave it. Slow: call it off the main thread.
 * Only the type and size are logged, never the content or where it came from.
 *
 * @throws ImageNotReceived if it can't be read or isn't an image a Picture can show.
 */
fun receiveImage(
    resolver: ContentResolver,
    uri: Uri,
    target: File,
): ReceivedImage {
    val bytes = copy(resolver, uri, target)
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(target.path, bounds)
    val type = bounds.outMimeType
    val extension = PICTURE_TYPES[type]
    if (extension == null || bounds.outWidth <= 0 || bounds.outHeight <= 0) {
        throw ImageNotReceived(ImageProblem.NOT_AN_IMAGE, "dropped content ($type, $bytes bytes) is not an image")
    }
    AppLog.i("received a $type image: $bytes bytes, ${bounds.outWidth}x${bounds.outHeight} px")
    return ReceivedImage(target, extension, bounds.outWidth, bounds.outHeight)
}

// Returns how many bytes were copied; stops with TOO_BIG past MAX_IMAGE_BYTES.
private fun copyAtMost(
    source: InputStream,
    out: OutputStream,
): Long {
    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
    var total = 0L
    var read = source.read(buffer)
    while (read >= 0) {
        total += read
        if (total > MAX_IMAGE_BYTES) {
            throw ImageNotReceived(ImageProblem.TOO_BIG, "dropped content is over $MAX_IMAGE_BYTES bytes")
        }
        out.write(buffer, 0, read)
        read = source.read(buffer)
    }
    return total
}

// Returns how many bytes were copied.
private fun copy(
    resolver: ContentResolver,
    uri: Uri,
    target: File,
): Long =
    try {
        target.parentFile?.mkdirs()
        val input = resolver.openInputStream(uri) ?: throw IOException("the provider gave no stream")
        input.use { source -> target.outputStream().use { out -> copyAtMost(source, out) } }
    } catch (e: IOException) {
        throw ImageNotReceived(ImageProblem.UNREADABLE, "couldn't read the dropped content", e)
    } catch (e: SecurityException) {
        throw ImageNotReceived(ImageProblem.UNREADABLE, "no permission to read the dropped content", e)
    }
