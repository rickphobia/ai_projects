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
import com.rickphobia.ricknotes.core.settings.InvalidSettingException
import com.rickphobia.ricknotes.core.settings.SettingsLoader
import com.rickphobia.ricknotes.core.settings.SettingsSource
import com.rickphobia.ricknotes.core.settings.SettingsStore
import com.rickphobia.ricknotes.core.studyfolder.RecentDocuments
import com.rickphobia.ricknotes.diagnostics.PenTestScreen
import com.rickphobia.ricknotes.files.PdfEntry
import com.rickphobia.ricknotes.home.HomeLibrary
import com.rickphobia.ricknotes.home.HomeScreen
import com.rickphobia.ricknotes.logging.AppLog
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
import com.rickphobia.ricknotes.viewer.ReadingPositions

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

    data class Document(
        val studyFolder: String,
        val pdf: PdfEntry,
    ) : Screen
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
                    HomeScreen(
                        versionName = versionName,
                        studyFolder = current.studyFolder,
                        library = HomeLibrary(recentDocuments::paths, courseFolders),
                        onOpenSettings = { screen = Screen.Settings(current.studyFolder) },
                        onOpenPdf = { pdf -> screen = Screen.Document(current.studyFolder, pdf) },
                    )
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
                    DocumentScreen(current.pdf, storage.readingPositions, favouritePens.pens, fingerGestures.gestures) {
                        screen =
                            Screen.Home(current.studyFolder)
                    }
                }
            }
        }
    }
}
