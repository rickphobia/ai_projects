package com.rickphobia.ricknotes

import android.content.Intent
import android.os.Bundle
import android.os.Environment
import android.provider.DocumentsContract
import android.provider.Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.mutableStateOf
import androidx.core.content.FileProvider
import androidx.core.net.toUri
import com.rickphobia.ricknotes.adapters.settings.SharedPreferencesReadingPositions
import com.rickphobia.ricknotes.adapters.settings.SharedPreferencesSettingsSource
import com.rickphobia.ricknotes.files.TreeDocumentPaths
import com.rickphobia.ricknotes.imports.IncomingShare
import com.rickphobia.ricknotes.logging.AppLog
import com.rickphobia.ricknotes.panes.KeyShortcuts
import java.io.File
import java.io.IOException

/** Wires the pieces together; the rules live in `core`. */
class MainActivity : ComponentActivity() {
    // Re-read on every resume: the user grants "All files access" in the system's settings
    // screen and comes back with Back, which only resumes this activity.
    private val hasAllFilesAccess = mutableStateOf(false)

    // A file shared with Share → RickNotes; a share while the app is open arrives in onNewIntent.
    private val share = mutableStateOf<IncomingShare?>(null)

    private val shortcuts = KeyShortcuts()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        AppLog.start(File(filesDir, LOG_DIR))
        AppLog.i("started ${BuildConfig.VERSION_NAME}")
        val storage =
            AppStorage(
                settings = SharedPreferencesSettingsSource.open(this),
                readingPositions = SharedPreferencesReadingPositions.open(this),
            )

        // After a rotation the share was already taken.
        if (savedInstanceState == null) share.value = IncomingShare.from(intent)
        enableEdgeToEdge()
        setContent {
            RickNotesApp(
                versionName = BuildConfig.VERSION_NAME,
                hasAllFilesAccess = hasAllFilesAccess.value,
                storage = storage,
                system =
                    SystemActions(
                        openAllFilesAccessSetting = ::openAllFilesAccessSetting,
                        pickedFolderPath = ::pickedFolderPath,
                        shareLog = ::shareLog,
                        shortcuts = shortcuts,
                    ),
                share = share.value,
            )
        }
    }

    override fun onKeyShortcut(
        keyCode: Int,
        event: KeyEvent,
    ): Boolean = shortcuts.handle(event) || super.onKeyShortcut(keyCode, event)

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        IncomingShare.from(intent)?.let { share.value = it }
    }

    override fun onResume() {
        super.onResume()
        hasAllFilesAccess.value = Environment.isExternalStorageManager()
        AppLog.i("all files access granted: ${hasAllFilesAccess.value}")
    }

    private fun openAllFilesAccessSetting() {
        startActivity(Intent(ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, "package:$packageName".toUri()))
    }

    private fun pickedFolderPath(treeUri: android.net.Uri): String? =
        TreeDocumentPaths.toPath(
            treeDocumentId = DocumentsContract.getTreeDocumentId(treeUri),
            primaryStorageRoot = Environment.getExternalStorageDirectory().path,
        )

    /** Copies the log into the shared cache folder and hands it to the Android share menu. */
    private fun shareLog() {
        val copy = File(File(cacheDir, SHARED_DIR), "ricknotes-log.txt")
        try {
            AppLog.exportTo(copy)
        } catch (e: IOException) {
            AppLog.e("copying the log for sharing failed", e)
            return
        }
        AppLog.i("sharing the log (${copy.length()} bytes)")
        val uri = FileProvider.getUriForFile(this, "$packageName.files", copy)
        val send =
            Intent(Intent.ACTION_SEND)
                .setType("text/plain")
                .putExtra(Intent.EXTRA_STREAM, uri)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        startActivity(Intent.createChooser(send, getString(R.string.share_log_chooser)))
    }

    private companion object {
        const val LOG_DIR = "logs"

        // Must match res/xml/shared_files.xml.
        const val SHARED_DIR = "shared"
    }
}
