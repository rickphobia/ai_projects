package com.rickphobia.ricknotes

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import com.rickphobia.ricknotes.core.ink.FavouritePens
import com.rickphobia.ricknotes.core.layout.TabPosition
import com.rickphobia.ricknotes.core.studyfolder.CourseFolders
import com.rickphobia.ricknotes.core.touch.FingerGestures
import com.rickphobia.ricknotes.files.PdfEntry
import com.rickphobia.ricknotes.panes.KeyShortcuts
import com.rickphobia.ricknotes.panes.PaneContext
import com.rickphobia.ricknotes.panes.PaneNavigation
import com.rickphobia.ricknotes.panes.PaneScreen
import com.rickphobia.ricknotes.panes.PaneSources
import com.rickphobia.ricknotes.panes.startPosition
import com.rickphobia.ricknotes.revisionlog.CourseFolder
import com.rickphobia.ricknotes.viewer.DocumentSettings
import com.rickphobia.ricknotes.viewer.SharedImage

// Opens at the Entry's page even when the Document's Tab is already open, keeping the zoom it was
// last read at.
internal fun openAtPage(
    storage: AppStorage<*>,
    pdf: PdfEntry,
    pageNumber: Int,
) {
    val zoom = startPosition(storage.readingPositions, pdf).zoom
    storage.layout.change { openAt(pdf.treePath, TabPosition(pageNumber - 1, zoom)) }
}

/** What the Tab of [pdf] takes from the settings, with its Course folder found in [courses]. */
internal fun documentSettings(
    pdf: PdfEntry,
    studyFolder: String,
    pens: FavouritePens,
    gestures: FingerGestures,
    courses: CourseFolders,
) = DocumentSettings(pens, gestures, CourseFolder.of(pdf, studyFolder, courses), studyFolder)

/**
 * The Tabs of [route], Back going where it says and closing the last Tab going home. The selected
 * Tab's Document counts as opened for Recent Documents.
 */
@Composable
internal fun DocumentRoute(
    route: Screen.Document,
    storage: AppStorage<*>,
    shortcuts: KeyShortcuts,
    sources: PaneSources,
    go: (Screen) -> Unit,
) {
    val layout = storage.layout.layout
    val selected = layout.selectedTab?.path
    LaunchedEffect(selected) { selected?.let(storage.recentDocuments::opened) }
    val sharedImage =
        remember(route.sharedImage) {
            route.sharedImage?.let { uri -> SharedImage(uri) { go(Screen.Home(route.studyFolder, sharedImage = uri)) } }
        }
    val context =
        PaneContext(
            studyFolder = route.studyFolder,
            layout = storage.layout,
            positions = storage.readingPositions,
            shortcuts = shortcuts,
            sources = sources,
            navigation = PaneNavigation(back = { go(route.back) }, home = { go(Screen.Home(route.studyFolder)) }),
        )
    PaneScreen(context, sharedImage)
}

/** Home, or the Tabs when [start] is home and Tabs were left open. */
internal fun resumeTabs(
    start: Screen,
    storage: AppStorage<*>,
): Screen {
    val tabsOpen = storage.layout.layout.selectedTab != null
    return if (start is Screen.Home && tabsOpen) Screen.Document(start.studyFolder) else start
}
