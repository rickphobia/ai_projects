package com.rickphobia.ricknotes.viewer

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.ScrollableDefaults
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListLayoutInfo
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import androidx.ink.rendering.android.canvas.CanvasStrokeRenderer
import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.core.ink.PagePlacement
import com.rickphobia.ricknotes.ink.DocumentInk
import com.rickphobia.ricknotes.ink.InkLayer
import com.rickphobia.ricknotes.ink.PageInk
import com.rickphobia.ricknotes.ink.PenMode
import com.rickphobia.ricknotes.logging.AppLog
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.io.File
import kotlin.math.roundToInt

private val PAGE_GAP = 8.dp

// How long the view must be still before zoomed pages are drawn sharp again: long enough to skip
// the frames of a pinch or fling, short enough that the student doesn't wait.
private const val SETTLE_MS = 250L

// The reading position is saved this long after it stops changing, and again on leaving.
private const val SAVE_DELAY_MS = 500L

// A sharp part reaches this share of the screen past each edge, so small scrolls stay sharp.
private const val SHARP_MARGIN_SHARE = 8

/** Where the pages of one Document are being looked at from: what [PageList] needs from its screen. */
internal data class OpenDocument(
    val pages: PdfPages,
    val pageSizes: List<PageSize>,
    val path: String,
    val positions: ReadingPositions,
    val ink: DocumentInk,
    val penMode: () -> PenMode,
)

/**
 * The pages of a Document in one zoomable column, with the ink layer over them: the pen writes, one
 * finger scrolls, two fingers pinch-zoom and pan. It reopens where the student left it and
 * remembers where they leave it.
 */
@Composable
internal fun PageList(document: OpenDocument) {
    val pageCount = document.pageSizes.size
    val restored = remember(document.path) { restoredPosition(document) }
    val listState = rememberLazyListState(initialFirstVisibleItemIndex = restored.pageIndex)
    val view = remember { mutableStateOf(ZoomView(restored.zoom, panX = 0f)) }
    var settled by remember { mutableStateOf<SettledView?>(null) }
    val scope = rememberCoroutineScope()
    val ink = document.ink
    val strokeRenderer = remember { CanvasStrokeRenderer.create() }

    BoxWithConstraints(
        modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surfaceVariant).clipToBounds(),
    ) {
        val screen = ViewportSize(constraints.maxWidth, constraints.maxHeight)
        val gapPx = with(LocalDensity.current) { PAGE_GAP.roundToPx() }
        val pageWidthPx = zoomedListWidth(screen, view.value) - gapPx * 2
        val pageLayout = { index: Int, size: PageSize ->
            PageLayout(index, size, baseWidthPx = screen.width - gapPx * 2, sharpMarginPx = sharpMargin(screen))
        }
        val current by remember(screen) {
            derivedStateOf {
                currentPage(visiblePages(listState.layoutInfo), screen.height) ?: listState.firstVisibleItemIndex
            }
        }
        LaunchedEffect(listState, screen, gapPx) {
            snapshotFlow { listState.layoutInfo to view.value }.collectLatest { (info, stillView) ->
                delay(SETTLE_MS)
                settled = settle(info, stillView, screen, gapPx)
            }
        }
        SavePosition(document) { ReadingPosition(current, view.value.zoom) }

        LazyColumn(
            state = listState,
            contentPadding = PaddingValues(PAGE_GAP),
            verticalArrangement = Arrangement.spacedBy(PAGE_GAP),
            // Every touch goes to the ink layer on top, which moves the list itself.
            userScrollEnabled = false,
            modifier = Modifier.zoomedLayout(view, screen),
        ) {
            itemsIndexed(document.pageSizes) { index, size ->
                val part = settled?.takeIf { it.pageWidth == pageWidthPx }
                PageView(
                    document.pages,
                    pageLayout(index, size),
                    part?.let { SettledPart(it.pageWidth, it.visibleParts[index]) },
                ) { PageInk(ink, PageId.ofPdfPage(index), size.widthPt.toFloat(), strokeRenderer) }
            }
        }
        TouchLayer(document, PageListView(view, listState, screen, gapPx))
        PageNavigator(
            pageIndex = current,
            pageCount = pageCount,
            onJump = { index -> scope.launch { listState.scrollToItem(index) } },
            modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp),
        )
    }
}

/** What the touch layer needs to find pages on screen and move them. */
private class PageListView(
    val zoom: MutableState<ZoomView>,
    val listState: LazyListState,
    val screen: ViewportSize,
    val gapPx: Int,
) {
    /** Where each page on screen is right now. */
    fun placements(pageSizes: List<PageSize>): List<PagePlacement> {
        val view = zoom.value
        val pageWidth = zoomedListWidth(screen, view) - gapPx * 2
        return pagePlacements(visiblePages(listState.layoutInfo), pageSizes, pageWidth, gapPx, view)
    }
}

/** The ink layer over the pages: it takes every touch, writes with the pen and moves [list] with fingers. */
@Composable
private fun TouchLayer(
    document: OpenDocument,
    list: PageListView,
) {
    val scope = rememberCoroutineScope()
    val flingBehavior = ScrollableDefaults.flingBehavior()
    val navigation =
        remember(list.listState, list.screen, scope, flingBehavior) {
            PageNavigation(list.zoom, list.listState, list.screen, scope, flingBehavior)
        }
    InkLayer(
        ink = document.ink,
        placements = { list.placements(document.pageSizes) },
        navigation = navigation,
        penMode = document.penMode,
    )
}

private fun restoredPosition(document: OpenDocument): ReadingPosition {
    val position =
        document.positions.load(document.path)?.fitTo(document.pageSizes.size) ?: ReadingPosition(0, ZoomLimits.MIN)
    AppLog.i("reopening ${File(document.path).name} at page ${position.pageIndex + 1}, zoom ${position.zoom}")
    return position
}

/** The page list's width at [view]'s zoom: the pages plus the gaps either side. */
private fun zoomedListWidth(
    screen: ViewportSize,
    view: ZoomView,
): Int = (screen.width * view.zoom).roundToInt()

private fun sharpMargin(screen: ViewportSize): Int = minOf(screen.width, screen.height) / SHARP_MARGIN_SHARE

/** Saves where the student is once it stops changing, and again when the Document closes. */
@Composable
private fun SavePosition(
    document: OpenDocument,
    position: () -> ReadingPosition,
) {
    LaunchedEffect(document) {
        snapshotFlow(position).collectLatest {
            delay(SAVE_DELAY_MS)
            document.positions.save(document.path, it)
        }
    }
    DisposableEffect(document) {
        onDispose { document.positions.save(document.path, position()) }
    }
}

/**
 * Lays the page list out as wide as the zoomed pages and slides it sideways under the screen; up
 * and down is the list's own scrolling.
 */
private fun Modifier.zoomedLayout(
    view: MutableState<ZoomView>,
    screen: ViewportSize,
): Modifier =
    layout { measurable, constraints ->
        val contentWidth = zoomedListWidth(screen, view.value)
        val placeable = measurable.measure(Constraints.fixed(contentWidth, constraints.maxHeight))
        layout(constraints.maxWidth, constraints.maxHeight) {
            placeable.place(-view.value.panX.roundToInt(), 0)
        }
    }

/** The view once it stopped moving: the page width, and which part of each laid-out page shows. */
private data class SettledView(
    val pageWidth: Int,
    val visibleParts: Map<Int, PixelRect?>,
)

private fun settle(
    info: LazyListLayoutInfo,
    view: ZoomView,
    screen: ViewportSize,
    gapPx: Int,
): SettledView {
    val pageWidth = zoomedListWidth(screen, view) - gapPx * 2
    val parts =
        visiblePages(info).associate { page ->
            page.index to
                PlacedPage(page.top, gapPx, pageWidth, page.height).visiblePart(view.panX.roundToInt(), screen)
        }
    return SettledView(pageWidth, parts)
}

// Item offsets count from the end of the list's top padding; the screen's top is viewportStartOffset.
private fun visiblePages(info: LazyListLayoutInfo): List<VisiblePage> =
    info.visibleItemsInfo.map { VisiblePage(it.index, it.offset - info.viewportStartOffset, it.size) }
