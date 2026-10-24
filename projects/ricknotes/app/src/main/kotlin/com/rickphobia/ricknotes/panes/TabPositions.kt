package com.rickphobia.ricknotes.panes

import com.rickphobia.ricknotes.core.layout.Layout
import com.rickphobia.ricknotes.core.layout.TabPosition
import com.rickphobia.ricknotes.files.PdfEntry
import com.rickphobia.ricknotes.settings.LayoutSetting
import com.rickphobia.ricknotes.viewer.ReadingPosition
import com.rickphobia.ricknotes.viewer.ReadingPositions
import com.rickphobia.ricknotes.viewer.ZoomLimits
import java.io.File

/**
 * Where a Document not yet in a Tab opens: where it was last left, from [positions], or the top.
 */
internal fun startPosition(
    positions: ReadingPositions,
    pdf: PdfEntry,
): TabPosition {
    val position = positions.load(pdf.path) ?: ReadingPosition(0, ZoomLimits.MIN)
    return TabPosition(position.pageIndex, position.zoom)
}

/** The PDF at tree [path] in [studyFolder]. */
internal fun pdfAt(
    studyFolder: String,
    path: String,
) = PdfEntry(
    File(studyFolder, path).path,
    path.substringBeforeLast('/', missingDelimiterValue = ""),
    path.substringAfterLast('/'),
)

/**
 * The reading position of the Tab of [path] in [pane]: kept in the Layout, so the Tab comes back
 * where it was, and in the Document's own [ReadingPositions], so it reopens there after its Tab is
 * closed. The same Document in the other Pane has its own position.
 */
internal class TabPositions(
    private val layout: LayoutSetting<*>,
    private val pane: Int,
    private val path: String,
    private val documents: ReadingPositions,
) : ReadingPositions {
    override fun load(documentPath: String): ReadingPosition? =
        tabIndex(layout.layout)?.let { index ->
            layout.layout.panes[pane]
                .tabs[index]
                .position
                .let { ReadingPosition(it.pageIndex, it.zoom) }
        }

    override fun save(
        documentPath: String,
        position: ReadingPosition,
    ) {
        documents.save(documentPath, position)
        // A closed Tab saves its position as it goes: then only the Document keeps it.
        layout.change {
            tabIndex(this)?.let { moved(pane, it, TabPosition(position.pageIndex, position.zoom)) } ?: this
        }
    }

    private fun tabIndex(layout: Layout): Int? =
        layout.panes
            .getOrNull(pane)
            ?.tabs
            ?.indexOfFirst { it.path == path }
            ?.takeIf { it >= 0 }
}
