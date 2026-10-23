package com.rickphobia.ricknotes

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.rickphobia.ricknotes.core.ink.FavouritePens
import com.rickphobia.ricknotes.core.revisionlog.Entry
import com.rickphobia.ricknotes.core.settings.InvalidSettingException
import com.rickphobia.ricknotes.core.settings.SettingsLoader
import com.rickphobia.ricknotes.core.settings.SettingsSource
import com.rickphobia.ricknotes.core.settings.SettingsStore
import com.rickphobia.ricknotes.core.studyfolder.CourseFolders
import com.rickphobia.ricknotes.core.studyfolder.RecentDocuments
import com.rickphobia.ricknotes.core.touch.FingerGestures
import com.rickphobia.ricknotes.diagnostics.PenTestScreen
import com.rickphobia.ricknotes.files.PdfEntry
import com.rickphobia.ricknotes.home.CourseFolderActions
import com.rickphobia.ricknotes.home.HomeLibrary
import com.rickphobia.ricknotes.home.HomeNavigation
import com.rickphobia.ricknotes.home.HomeScreen
import com.rickphobia.ricknotes.logging.AppLog
import com.rickphobia.ricknotes.revisionlog.CourseFolder
import com.rickphobia.ricknotes.revisionlog.ReviewScreen
import com.rickphobia.ricknotes.revisionlog.RevisionLogScreen
import com.rickphobia.ricknotes.revisionlog.RevisionLogSessions
import com.rickphobia.ricknotes.settings.CourseFoldersSetting
import com.rickphobia.ricknotes.settings.FavouritePensEditor
import com.rickphobia.ricknotes.settings.FavouritePensSetting
import com.rickphobia.ricknotes.settings.FingerGesturesEditor
import com.rickphobia.ricknotes.settings.FingerGesturesSetting
import com.rickphobia.ricknotes.settings.SettingsActions
import com.rickphobia.ricknotes.settings.SettingsScreen
import com.rickphobia.ricknotes.studyfolder.AllFilesAccessScreen
import com.rickphobia.ricknotes.studyfolder.PickFolderScreen
import com.rickphobia.ricknotes.theme.RickNotesTheme
import com.rickphobia.ricknotes.viewer.DocumentScreen
import com.rickphobia.ricknotes.viewer.DocumentSettings
import com.rickphobia.ricknotes.viewer.ReadingPosition
import com.rickphobia.ricknotes.viewer.ReadingPositions
import com.rickphobia.ricknotes.viewer.ZoomLimits
import java.io.File

/** Which screen is showing. Without a usable Study folder the app only offers the picker. */
private sealed interface Screen {
    data class PickFolder(
        val problem: String?,
    ) : Screen

    data class Home(
        val studyFolder: String,
    ) : Screen

    data class Settings(
        val studyFolder: String,
    ) : Screen

    data class PenTest(
        val studyFolder: String,
    ) : Screen

    /** The Revision log of [courseFolder], a path relative to the Study folder. */
    data class RevisionLog(
        val studyFolder: String,
        val courseFolder: String,
    ) : Screen

    data class Review(
        val studyFolder: String,
    ) : Screen

    /** An open Document; Back goes to [backTo], or home when it is null. */
    data class Document(
        val studyFolder: String,
        val pdf: PdfEntry,
        val backTo: Screen? = null,
    ) : Screen {
        val back: Screen get() = backTo ?: Home(studyFolder)

        /** What this Document's screen takes from the settings, with its Course folder found in [courses]. */
        fun settings(
            pens: FavouritePens,
            gestures: FingerGestures,
            courses: CourseFolders,
        ) = DocumentSettings(pens, gestures, CourseFolder.of(pdf, studyFolder, courses))
    }
}

/** Where the app keeps what it remembers: its settings, and where each Document was left. */
class AppStorage<S>(
    val settings: S,
    val readingPositions: ReadingPositions,
) where S : SettingsSource, S : SettingsStore

private fun problemText(error: InvalidSettingException) = "The Study folder ${error.value} ${error.reason}."

private fun startScreen(source: SettingsSource): Screen =
    try {
        SettingsLoader.load(source).studyFolder?.let { Screen.Home(it) } ?: Screen.PickFolder(problem = null)
    } catch (e: InvalidSettingException) {
        AppLog.w("stored settings unusable: ${e.message}")
        Screen.PickFolder(problemText(e))
    }

/** Saves the picked Study folder at [path] and goes home, or says why it can't be used. */
private fun afterPickingFolder(
    path: String?,
    store: SettingsStore,
): Screen =
    if (path == null) {
        AppLog.w("picked folder is not on the tablet's own storage")
        Screen.PickFolder("Pick a folder on the tablet's own storage, not an SD card or USB drive.")
    } else {
        try {
            SettingsLoader.saveStudyFolder(store, path)
            AppLog.i("study folder chosen")
            Screen.Home(path)
        } catch (e: InvalidSettingException) {
            AppLog.w("picked folder unusable: ${e.message}")
            Screen.PickFolder(problemText(e))
        }
    }

/** Where the home screen of [studyFolder] leads, going there with [go]. */
private fun homeNavigation(
    studyFolder: String,
    go: (Screen) -> Unit,
) = HomeNavigation(
    openSettings = { go(Screen.Settings(studyFolder)) },
    openPdf = { pdf -> go(Screen.Document(studyFolder, pdf)) },
    openRevisionLog = { course -> go(Screen.RevisionLog(studyFolder, course)) },
    openReview = { go(Screen.Review(studyFolder)) },
)

/** The home screen of [route], going to the screen it asks for with [go]. */
@Composable
private fun HomeRoute(
    route: Screen.Home,
    versionName: String,
    recentPaths: () -> List<String>,
    courseFolders: CourseFolderActions,
    go: (Screen) -> Unit,
) {
    // Walks the Study folder; the home screen calls it off the main thread.
    val dueCount = { RevisionLogSessions.dueCourses(File(route.studyFolder)).sumOf { it.entries.size } }
    val library = HomeLibrary(recentPaths, courseFolders, dueCount)
    HomeScreen(versionName, route.studyFolder, library, homeNavigation(route.studyFolder, go))
}

/** The Revision log screen of [route], going to the screen it asks for with [go]. */
@Composable
private fun RevisionLogRoute(
    route: Screen.RevisionLog,
    positions: ReadingPositions,
    go: (Screen) -> Unit,
) {
    RevisionLogScreen(
        courseFolder = File(route.studyFolder, route.courseFolder),
        onOpenDocument = { entry ->
            val pdf = entryDocument(entry, route.studyFolder)
            if (pdf != null) {
                openAtPage(positions, pdf, entry.source.pageNumber)
                go(Screen.Document(route.studyFolder, pdf, backTo = route))
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

// The Document screen opens where its reading position says, so the Entry's page goes there first,
// keeping the zoom the Document was last read at.
private fun openAtPage(
    positions: ReadingPositions,
    pdf: PdfEntry,
    pageNumber: Int,
) {
    val zoom = positions.load(pdf.path)?.zoom ?: ZoomLimits.MIN
    positions.save(pdf.path, ReadingPosition(pageNumber - 1, zoom))
}

/** What the screens ask Android to do, provided by `MainActivity`. */
class SystemActions(
    val openAllFilesAccessSetting: () -> Unit,
    val pickedFolderPath: (Uri) -> String?,
    val shareLog: () -> Unit,
)

@Composable
fun <S> RickNotesApp(
    versionName: String,
    hasAllFilesAccess: Boolean,
    storage: AppStorage<S>,
    system: SystemActions,
) where S : SettingsSource, S : SettingsStore {
    var screen by remember(hasAllFilesAccess) { mutableStateOf(startScreen(storage.settings)) }
    val favouritePens = remember { FavouritePensSetting(storage.settings) }
    val fingerGestures = remember { FingerGesturesSetting(storage.settings) }
    val recentDocuments = remember { RecentDocuments(storage.settings) }
    val courseFolders = remember { CourseFoldersSetting(storage.settings) }

    val picker =
        rememberLauncherForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
            if (uri == null) return@rememberLauncherForActivityResult
            screen = afterPickingFolder(system.pickedFolderPath(uri), storage.settings)
        }
    val pickFolder = { picker.launch(null) }

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
                    HomeRoute(current, versionName, recentDocuments::paths, courseFolders) { screen = it }
                }

                is Screen.RevisionLog -> {
                    RevisionLogRoute(current, storage.readingPositions) { screen = it }
                }

                is Screen.Review -> {
                    ReviewScreen(File(current.studyFolder)) { screen = Screen.Home(current.studyFolder) }
                }

                is Screen.Settings -> {
                    SettingsScreen(
                        studyFolder = current.studyFolder,
                        favouritePens = { FavouritePensEditor(favouritePens.pens, favouritePens::change) },
                        fingerGestures = { FingerGesturesEditor(fingerGestures.gestures, fingerGestures::change) },
                        actions =
                            SettingsActions(
                                changeFolder = pickFolder,
                                openPenTest = { screen = Screen.PenTest(current.studyFolder) },
                                shareLog = system.shareLog,
                                back = { screen = Screen.Home(current.studyFolder) },
                            ),
                    )
                }

                is Screen.PenTest -> {
                    PenTestScreen(onBack = { screen = Screen.Settings(current.studyFolder) })
                }

                is Screen.Document -> {
                    LaunchedEffect(current.pdf.path) { recentDocuments.opened(current.pdf.treePath) }
                    val settings = current.settings(favouritePens.pens, fingerGestures.gestures, courseFolders.folders)
                    DocumentScreen(current.pdf, storage.readingPositions, settings) { screen = current.back }
                }
            }
        }
    }
}
