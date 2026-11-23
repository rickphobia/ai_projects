package com.rickphobia.ricknotes.export

import android.graphics.BitmapFactory
import com.rickphobia.ricknotes.core.ink.Picture
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.PDPageContentStream
import com.tom_roush.pdfbox.pdmodel.graphics.image.JPEGFactory
import com.tom_roush.pdfbox.pdmodel.graphics.image.LosslessFactory
import com.tom_roush.pdfbox.pdmodel.graphics.image.PDImageXObject
import com.tom_roush.pdfbox.util.Matrix
import java.io.File
import java.io.IOException

/** A Picture whose image isn't in the Document's `.assets` folder, or can't be decoded. */
class PictureMissing : IOException("a Picture's image is missing from .assets or can't be read")

/**
 * The images of an Export's Pictures, read from [assetsFolder] and added to [document] once each,
 * however many Pictures show the same image. A JPEG goes in as it is; PNG and WebP are decoded and
 * stored lossless.
 */
internal class PictureImages(
    private val document: PDDocument,
    private val assetsFolder: File,
) {
    private val images = mutableMapOf<String, PDImageXObject>()

    /** @throws PictureMissing if [picture]'s image isn't there or can't be decoded. */
    fun of(picture: Picture): PDImageXObject = images.getOrPut(picture.imageFile) { read(picture.imageFile) }

    private fun read(name: String): PDImageXObject {
        val file = File(assetsFolder, name)
        if (!file.isFile) throw PictureMissing()
        if (file.extension.lowercase() in JPEG_EXTENSIONS) {
            return file.inputStream().use { JPEGFactory.createFromStream(document, it) }
        }
        val bitmap = BitmapFactory.decodeFile(file.path) ?: throw PictureMissing()
        return try {
            LosslessFactory.createFromImage(document, bitmap)
        } finally {
            bitmap.recycle()
        }
    }
}

/**
 * Draws [picture]'s image in its frame, in the app's page points (y down; the caller's transform
 * maps them to the PDF's), upright and where it is on screen.
 */
internal fun PDPageContentStream.drawPicture(
    picture: Picture,
    images: PictureImages,
) {
    // An image fills the unit square up from its bottom-left; y is down here, so it is flipped back.
    drawImage(
        images.of(picture),
        Matrix(picture.widthPt, 0f, 0f, -picture.heightPt, picture.left, picture.top + picture.heightPt),
    )
}

private val JPEG_EXTENSIONS = setOf("jpg", "jpeg")
