package com.rickphobia.ricknotes

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import com.rickphobia.ricknotes.core.settings.InvalidSettingException
import com.rickphobia.ricknotes.core.settings.SettingsLoader
import com.rickphobia.ricknotes.core.settings.SettingsSource
import com.rickphobia.ricknotes.core.settings.SettingsStore
import com.rickphobia.ricknotes.logging.AppLog

private fun problemText(error: InvalidSettingException) = "The Study folder ${error.value} ${error.reason}."

/** Home with the stored Study folder, or the folder picker when there is none or it can't be used. */
internal fun startScreen(source: SettingsSource): Screen =
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

/** Opens Android's folder picker for the Study folder, going to the screen after it with [go]. */
@Composable
internal fun rememberFolderPicker(
    system: SystemActions,
    store: SettingsStore,
    go: (Screen) -> Unit,
): () -> Unit {
    val picker =
        rememberLauncherForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
            if (uri == null) return@rememberLauncherForActivityResult
            go(afterPickingFolder(system.pickedFolderPath(uri), store))
        }
    return { picker.launch(null) }
}
