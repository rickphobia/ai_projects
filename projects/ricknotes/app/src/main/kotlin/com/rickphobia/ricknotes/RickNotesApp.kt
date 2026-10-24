package com.rickphobia.ricknotes

import android.net.Uri
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.rickphobia.ricknotes.core.revisionlog.Entry
import com.rickphobia.ricknotes.core.settings.SettingsSource
import com.rickphobia.ricknotes.core.settings.SettingsStore
import com.rickphobia.ricknotes.core.studyfolder.RecentDocuments
import com.rickphobia.ricknotes.diagnostics.PenTestScreen
import com.rickphobia.ricknotes.files.PdfEntry
import com.rickphobia.ricknotes.home.CourseFolderActions
import com.rickphobia.ricknotes.home.HomeLibrary
import com.rickphobia.ricknotes.home.HomeNavigation
import com.rickphobia.ricknotes.home.HomeScreen
import com.rickphobia.ricknotes.imports.IncomingShare
import com.rickphobia.ricknotes.logging.AppLog
import com.rickphobia.ricknotes.panes.KeyShortcuts
import com.rickphobia.ricknotes.panes.PaneSources
import com.rickphobia.ricknotes.panes.TreeSource
import com.rickphobia.ricknotes.panes.startPosition
import com.rickphobia.ricknotes.revisionlog.ReviewScreen
import com.rickphobia.ricknotes.revisionlog.RevisionLogScreen
import com.rickphobia.ricknotes.revisionlog.RevisionLogSessions
import com.rickphobia.ricknotes.settings.CourseFoldersSetting
import com.rickphobia.ricknotes.settings.FavouritePensEditor
import com.rickphobia.ricknotes.settings.FavouritePensSetting
import com.rickphobia.ricknotes.settings.FingerGesturesEditor
import com.rickphobia.ricknotes.settings.FingerGesturesSetting
import com.rickphobia.ricknotes.settings.LayoutSetting
import com.rickphobia.ricknotes.settings.SettingsActions
import com.rickphobia.ricknotes.settings.SettingsScreen
import com.rickphobia.ricknotes.studyfolder.AllFilesAccessScreen
import com.rickphobia.ricknotes.studyfolder.PickFolderScreen
import com.rickphobia.ricknotes.theme.RickNotesTheme
import com.rickphobia.ricknotes.viewer.ReadingPositions
import java.io.File

/** Where the app keeps what it remembers: its settings, and where each Document was left. */
class AppStorage<S>(
    val settings: S,
    val readingPositions: ReadingPositions,
) where S : SettingsSource, S : SettingsStore {
    val layout = LayoutSetting(settings)
    val recentDocuments = RecentDocuments(settings)

    /** Opens [pdf] in a Tab, or selects its Tab, where it was last left. */
    fun open(pdf: PdfEntry) = layout.change { open(pdf.treePath, startPosition(readingPositions, pdf)) }
}

/** Where the home screen [route] leads, going there with [go]; a Document opens with [open]. */
private fun homeNavigation(
    route: Screen.Home,
    open: (PdfEntry) -> Unit,
    go: (Screen) -> Unit,
) = HomeNavigation(
    openSettings = { go(Screen.Settings(route.studyFolder)) },
    openPdf = { pdf ->
        open(pdf)
        go(Screen.Document(route.studyFolder, sharedImage = route.sharedImage))
    },
    openRevisionLog = { course -> go(Screen.RevisionLog(route.studyFolder, course)) },
    openReview = { go(Screen.Review(route.studyFolder)) },
)

/** What the home screen of [studyFolder] lists. */
private fun homeLibrary(
    studyFolder: String,
    recentPaths: () -> List<String>,
    courseFolders: CourseFolderActions,
): HomeLibrary {
    // Walks the Study folder; the home screen calls it off the main thread.
    val dueCount = { RevisionLogSessions.dueCourses(File(studyFolder)).sumOf { it.entries.size } }
    return HomeLibrary(recentPaths, courseFolders, dueCount)
}

/** The home screen of [route], or the Document a shared image goes on; [open] opens a Document in a Tab. */
@Composable
private fun HomeRoute(
    route: Screen.Home,
    versionName: String,
    library: HomeLibrary,
    open: (PdfEntry) -> Unit,
    go: (Screen) -> Unit,
) {
    ChoosingForShare(route, go) {
        HomeScreen(versionName, route.studyFolder, library, homeNavigation(route, open, go))
    }
}

/** The Revision log screen of [route], going to the screen it asks for with [go]. */
@Composable
private fun RevisionLogRoute(
    route: Screen.RevisionLog,
    storage: AppStorage<*>,
    go: (Screen) -> Unit,
) {
    RevisionLogScreen(
        courseFolder = File(route.studyFolder, route.courseFolder),
        onOpenDocument = { entry ->
            val pdf = entryDocument(entry, route.studyFolder)
            if (pdf != null) {
                openAtPage(storage, pdf, entry.source.pageNumber)
                go(Screen.Document(route.studyFolder, backTo = route))
            }
            pdf != null
        },
        onBack = { go(Screen.Home(route.studyFolder)) },
    )
}

/** [entry]'s Document, or null when it has been renamed or moved. */
private fun entryDocument(
    entry: Entry,
    studyFolder: String,
): PdfEntry? {
    val path = entry.source.documentPath
    val file = File(studyFolder, path)
    if (!file.isFile) {
        AppLog.w("Open in Document: ${file.name} not found")
        return null
    }
    return PdfEntry(file.path, path.substringBeforeLast('/', ""), file.name)
}

/** The Settings screen of [route], editing [favouritePens] and [fingerGestures] in place. */
@Composable
private fun SettingsRoute(
    route: Screen.Settings,
    favouritePens: FavouritePensSetting<*>,
    fingerGestures: FingerGesturesSetting<*>,
    actions: SettingsActions,
) {
    SettingsScreen(
        studyFolder = route.studyFolder,
        favouritePens = { FavouritePensEditor(favouritePens.pens, favouritePens::change) },
        fingerGestures = { FingerGesturesEditor(fingerGestures.gestures, fingerGestures::change) },
        actions = actions,
    )
}

/** What the screens ask Android to do, and the keyboard shortcuts it hands them, provided by `MainActivity`. */
class SystemActions(
    val openAllFilesAccessSetting: () -> Unit,
    val pickedFolderPath: (Uri) -> String?,
    val shareLog: () -> Unit,
    val shortcuts: KeyShortcuts,
)

@Composable
fun <S> RickNotesApp(
    versionName: String,
    hasAllFilesAccess: Boolean,
    storage: AppStorage<S>,
    system: SystemActions,
    share: IncomingShare?,
) where S : SettingsSource, S : SettingsStore {
    var screen by remember(hasAllFilesAccess) { mutableStateOf(resumeTabs(startScreen(storage.settings), storage)) }
    val favouritePens = remember { FavouritePensSetting(storage.settings) }
    val fingerGestures = remember { FingerGesturesSetting(storage.settings) }
    val recentDocuments = storage.recentDocuments
    val courseFolders = remember { CourseFoldersSetting(storage.settings) }

    val pickFolder = rememberFolderPicker(system, storage.settings) { screen = it }
    if (hasAllFilesAccess) TakeShare(share, { screen }, recentDocuments::paths, storage::open) { screen = it }

    RickNotesTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
            if (!hasAllFilesAccess) {
                AllFilesAccessScreen(onOpenSetting = system.openAllFilesAccessSetting)
                return@Surface
            }
            when (val current = screen) {
                is Screen.PickFolder -> {
                    PickFolderScreen(problem = current.problem, onPick = pickFolder)
                }

                is Screen.Home -> {
                    val library = homeLibrary(current.studyFolder, recentDocuments::paths, courseFolders)
                    HomeRoute(current, versionName, library, storage::open) { screen = it }
                }

                is Screen.ShareFolder -> {
                    ShareFolderRoute(current, storage::open) { screen = it }
                }

                is Screen.RevisionLog -> {
                    RevisionLogRoute(current, storage) { screen = it }
                }

                is Screen.Review -> {
                    ReviewScreen(File(current.studyFolder)) { screen = Screen.Home(current.studyFolder) }
                }

                is Screen.Settings -> {
                    val actions =
                        SettingsActions(
                            changeFolder = pickFolder,
                            openPenTest = { screen = Screen.PenTest(current.studyFolder) },
                            shareLog = system.shareLog,
                            back = { screen = Screen.Home(current.studyFolder) },
                        )
                    SettingsRoute(current, favouritePens, fingerGestures, actions)
                }

                is Screen.PenTest -> {
                    PenTestScreen(onBack = { screen = Screen.Settings(current.studyFolder) })
                }

                is Screen.Document -> {
                    val pens = favouritePens.pens
                    val gestures = fingerGestures.gestures
                    val courses = courseFolders.folders
                    val settings = { pdf: PdfEntry ->
                        documentSettings(pdf, current.studyFolder, pens, gestures, courses)
                    }
                    val tree = TreeSource(recentDocuments::paths, courseFolders)
                    DocumentRoute(current, storage, system.shortcuts, PaneSources(settings, tree)) { screen = it }
                }
            }
        }
    }
}
