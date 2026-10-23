package com.rickphobia.ricknotes.core.session

import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path

/** An image that couldn't be copied into the Document's `.assets` folder, so no Picture was placed. */
class PictureNotPlaced(
    val folderName: String,
    cause: Exception,
) : Exception("couldn't copy the image into $folderName: ${cause.message}", cause)

/**
 * The folder beside a Document that holds its Pictures' images: `<pdf name>.assets`. Images are
 * copied in under new names and never changed or removed, so undo and Versions always find them.
 */
internal class PictureAssets(
    pdf: Path,
) {
    val folder: Path = pdf.resolveSibling("${pdf.fileName}$ASSETS_SUFFIX")

    /**
     * Copies [image] in as [name] through [writeSafely], so a half-written image is never there
     * under its real name. [image] itself is only read.
     *
     * @throws PictureNotPlaced if reading [image] or writing the copy fails.
     */
    fun copyIn(
        image: Path,
        name: String,
    ) {
        try {
            val bytes = Files.readAllBytes(image)
            Files.createDirectories(folder)
            writeSafely(folder.resolve(name), bytes)
        } catch (e: IOException) {
            throw PictureNotPlaced(folder.fileName.toString(), e)
        } catch (e: SecurityException) {
            throw PictureNotPlaced(folder.fileName.toString(), e)
        }
    }

    companion object {
        const val ASSETS_SUFFIX = ".assets"
    }
}
