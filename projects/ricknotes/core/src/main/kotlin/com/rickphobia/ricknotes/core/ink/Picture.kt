package com.rickphobia.ricknotes.core.ink

/** A Picture's ID: made once when it is placed and never changed. */
@JvmInline
value class PictureId(
    val value: String,
)

/**
 * An image placed on a page, drawn under the ink and over the page. [imageFile] is the image's name
 * in the Document's `.assets` folder; position and size are in PDF points from the page's top-left
 * corner, so it stays on the same spot at any zoom.
 */
data class Picture(
    val id: PictureId,
    val pageId: PageId,
    val imageFile: String,
    val left: Float,
    val top: Float,
    val widthPt: Float,
    val heightPt: Float,
) {
    init {
        require(widthPt > 0f && heightPt > 0f) { "picture ${id.value} is ${widthPt}x$heightPt" }
        // Only a plain name: an Ink file must never point the app at a file outside `.assets`.
        require(imageFile.isNotBlank() && '/' !in imageFile && '\\' !in imageFile && imageFile != "..") {
            "picture ${id.value} has image file \"$imageFile\""
        }
    }
}
