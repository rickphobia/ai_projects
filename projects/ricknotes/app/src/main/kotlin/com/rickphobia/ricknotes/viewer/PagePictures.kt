package com.rickphobia.ricknotes.viewer

import android.graphics.BitmapFactory
import android.util.LruCache
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.ink.rendering.android.canvas.CanvasStrokeRenderer
import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.Picture
import com.rickphobia.ricknotes.ink.DocumentInk
import com.rickphobia.ricknotes.ink.PageInk
import com.rickphobia.ricknotes.logging.AppLog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.math.roundToInt

// A Picture's image is loaded no bigger than this on its long side: sharp on a full-width page at
// 2x zoom, and a big photo doesn't fill the memory.
private const val MAX_IMAGE_PX = 2048

// Decoded images kept while the app runs, so scrolling back to a page doesn't flash its Pictures.
private const val CACHE_BYTES = 64 * 1024 * 1024
private const val BYTES_PER_PIXEL = 4

private val loadedImages =
    object : LruCache<String, ImageBitmap>(CACHE_BYTES) {
        override fun sizeOf(
            key: String,
            value: ImageBitmap,
        ): Int = value.width * value.height * BYTES_PER_PIXEL
    }

/** What is drawn over a page: its Pictures, then its ink on top. */
@Composable
internal fun PageOverlay(
    ink: DocumentInk,
    pageId: PageId,
    pageWidthPt: Float,
    strokeRenderer: CanvasStrokeRenderer,
) {
    PagePictures(ink.picturesOn(pageId), ink.assetsFolder, pageWidthPt)
    PageInk(ink, pageId, pageWidthPt, strokeRenderer)
}

/**
 * Draws [pictures] on a page [pageWidthPt] points wide, over the page and under its ink. Their
 * images are in [assetsFolder]; one that can't be read is left out and logged, and stays in the Ink
 * file.
 */
@Composable
private fun PagePictures(
    pictures: List<Picture>,
    assetsFolder: File,
    pageWidthPt: Float,
) {
    pictures.forEach { picture ->
        val image by produceState(loadedImages.get(picture.imageFile), picture.imageFile) {
            if (value == null) value = withContext(Dispatchers.IO) { load(File(assetsFolder, picture.imageFile)) }
        }
        image?.let { bitmap ->
            Canvas(modifier = Modifier.fillMaxSize().clipToBounds()) {
                val scale = size.width / pageWidthPt
                drawImage(
                    image = bitmap,
                    dstOffset = IntOffset((picture.left * scale).roundToInt(), (picture.top * scale).roundToInt()),
                    dstSize = IntSize((picture.widthPt * scale).roundToInt(), (picture.heightPt * scale).roundToInt()),
                )
            }
        }
    }
}

private fun load(file: File): ImageBitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.path, bounds)
    val longSide = maxOf(bounds.outWidth, bounds.outHeight)
    var sample = 1
    while (longSide / sample > MAX_IMAGE_PX) sample *= 2
    val bitmap = BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample })
    if (bitmap == null) {
        AppLog.e("can't draw Picture image ${file.name}; it is kept but not shown")
        return null
    }
    return bitmap.asImageBitmap().also { loadedImages.put(file.name, it) }
}
