package com.rickphobia.ricknotes.viewer

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.core.graphics.withScale
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.ink.PageBackground
import com.rickphobia.ricknotes.logging.AppLog
import kotlin.math.roundToInt

/**
 * What showed of a page when the view last settled: [visible] at a page [pageWidth] pixels wide,
 * null if the page was off screen.
 */
internal data class SettledPart(
    val pageWidth: Int,
    val visible: PixelRect?,
)

/**
 * How one PDF page is drawn at the current zoom: page [index] of the PDF, shown as the Document's
 * page [number], which counts Inserted pages too.
 */
internal data class PageLayout(
    val index: Int,
    val number: Int,
    val size: PageSize,
    val baseWidthPx: Int,
    val sharpMarginPx: Int,
)

/**
 * An Inserted page, shown as page [number]: white paper with [background]'s lines or dots, drawn as
 * shapes so it is sharp at any zoom. [overlay] is drawn on top, filling the page: its ink.
 */
@Composable
internal fun InsertedPageView(
    background: PageBackground,
    pageSize: PageSize,
    number: Int,
    overlay: @Composable () -> Unit,
) {
    val description = stringResource(R.string.page_number, number)
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .aspectRatio(pageSize.aspectRatio)
                .background(Color.White)
                .semantics { contentDescription = description },
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val pixelsPerPoint = size.width / pageSize.widthPt
            drawIntoCanvas { canvas ->
                canvas.nativeCanvas.withScale(pixelsPerPoint, pixelsPerPoint, 0f, 0f) {
                    drawPaper(background, pageSize)
                }
            }
        }
        overlay()
    }
}

/**
 * One PDF page: its whole image at the screen's width, stretched while zooming, with a sharp image of
 * the part on screen drawn over it once the view settles. [settled] is null while it is moving.
 * [overlay] is drawn on top, filling the page: its ink.
 */
@Composable
internal fun PageView(
    pages: PdfPages,
    layout: PageLayout,
    settled: SettledPart?,
    overlay: @Composable () -> Unit,
) {
    val index = layout.index
    val drawn by wholePage(pages, layout)
    var sharp by remember(pages, index) { mutableStateOf<SharpImage?>(null) }
    LaunchedEffect(settled, layout) {
        val part = settled ?: return@LaunchedEffect
        val scale = PageScale(part.pageWidth, layout.size.heightPx(part.pageWidth), layout.baseWidthPx)
        when (val plan = planDetail(sharp?.part, part.visible, scale, layout.sharpMarginPx)) {
            DetailPlan.Keep -> {}

            DetailPlan.Drop -> {
                sharp = null
            }

            is DetailPlan.Render -> {
                sharp =
                    try {
                        val bitmap = pages.renderPart(index, layout.size, part.pageWidth, plan.region)
                        SharpImage(SharpPart(plan.region, part.pageWidth), bitmap.asImageBitmap())
                    } catch (e: PageRenderException) {
                        // The stretched whole page still shows; a blurry page beats a blank one.
                        AppLog.e("drawing a page failed: ${e.message}", e)
                        null
                    }
            }
        }
    }
    // The page's box takes its final shape at once, so the list never jumps when a page arrives.
    Box(
        modifier = Modifier.fillMaxWidth().aspectRatio(layout.size.aspectRatio).background(Color.White),
        contentAlignment = Alignment.Center,
    ) {
        when (val current = drawn) {
            is PageImage.Drawn -> {
                Image(
                    bitmap = current.bitmap,
                    contentDescription = stringResource(R.string.page_number, layout.number),
                    contentScale = ContentScale.FillBounds,
                    modifier = Modifier.fillMaxSize(),
                )
            }

            PageImage.Failed -> {
                Text(stringResource(R.string.page_failed, layout.number), color = Color.DarkGray)
            }

            PageImage.Pending -> {}
        }
        sharp?.let { SharpOverlay(it) }
        overlay()
    }
}

/** The whole page drawn at the screen's width: from the cache at once if it is there. */
@Composable
private fun wholePage(
    pages: PdfPages,
    layout: PageLayout,
): State<PageImage> {
    val index = layout.index
    return produceState(
        pages.cached(index, layout.baseWidthPx)?.let { PageImage.Drawn(it.asImageBitmap()) } ?: PageImage.Pending,
        pages,
        index,
        layout.baseWidthPx,
    ) {
        if (value is PageImage.Drawn) return@produceState
        value =
            try {
                PageImage.Drawn(pages.render(index, layout.size, layout.baseWidthPx).asImageBitmap())
            } catch (e: PageRenderException) {
                AppLog.e("drawing a page failed: ${e.message}", e)
                PageImage.Failed
            }
    }
}

/** Draws a sharp part where it belongs on the page, scaled if the zoom has moved on since it was drawn. */
@Composable
private fun SharpOverlay(sharp: SharpImage) {
    Canvas(modifier = Modifier.fillMaxSize()) {
        val scale = size.width / sharp.part.pageWidth
        val region = sharp.part.region
        drawImage(
            image = sharp.bitmap,
            dstOffset = IntOffset((region.left * scale).roundToInt(), (region.top * scale).roundToInt()),
            dstSize = IntSize((region.width * scale).roundToInt(), (region.height * scale).roundToInt()),
        )
    }
}

private data class SharpImage(
    val part: SharpPart,
    val bitmap: ImageBitmap,
)

private sealed interface PageImage {
    data object Pending : PageImage

    data object Failed : PageImage

    data class Drawn(
        val bitmap: ImageBitmap,
    ) : PageImage
}
