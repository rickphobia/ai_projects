package com.rickphobia.ricknotes

import android.widget.Toast
import androidx.activity.compose.LocalActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.files.PdfEntry
import com.rickphobia.ricknotes.imports.IncomingShare
import com.rickphobia.ricknotes.imports.PdfCopyIn
import com.rickphobia.ricknotes.imports.ShareFolderPicker
import com.rickphobia.ricknotes.imports.ShareKind
import com.rickphobia.ricknotes.imports.ShareRoute
import com.rickphobia.ricknotes.imports.shareRoute
import com.rickphobia.ricknotes.logging.AppLog
import com.rickphobia.ricknotes.panes.pdfAt
import java.io.File

/**
 * Sends a file shared to RickNotes where story 44 says, from whichever screen is [current]: see
 * [shareRoute]. Each share is taken once; one that arrives before a Study folder is picked is
 * refused with a message.
 */
@Composable
internal fun TakeShare(
    share: IncomingShare?,
    current: () -> Screen,
    recentPaths: () -> List<String>,
    open: (PdfEntry) -> Unit,
    go: (Screen) -> Unit,
) {
    val context = LocalContext.current
    LaunchedEffect(share) {
        if (share == null || !share.take()) return@LaunchedEffect
        val studyFolder = current().studyFolder
        val uri = share.uri
        val kind = if (uri == null) ShareKind.OTHER else share.kind
        AppLog.i("share received: $kind")
        if (studyFolder == null) {
            AppLog.w("share refused: no Study folder yet")
            Toast.makeText(context, R.string.share_no_study_folder, Toast.LENGTH_LONG).show()
            return@LaunchedEffect
        }
        when (val route = shareRoute(kind, recentPaths()) { File(studyFolder, it).isFile }) {
            ShareRoute.Refuse -> {
                AppLog.w("share refused: type ${share.type}, content ${uri != null}")
                Toast.makeText(context, R.string.share_not_supported, Toast.LENGTH_LONG).show()
            }

            is ShareRoute.ChooseFolder -> {
                go(Screen.ShareFolder(studyFolder, checkNotNull(uri), route.startFolder))
            }

            is ShareRoute.OpenDocument -> {
                open(pdfAt(studyFolder, route.path))
                go(Screen.Document(studyFolder, sharedImage = uri))
            }

            ShareRoute.ChooseDocument -> {
                go(Screen.Home(studyFolder, sharedImage = uri))
            }
        }
    }
}

/** The Study folder of a screen, or null before one is picked. */
private val Screen.studyFolder: String?
    get() =
        when (this) {
            is Screen.PickFolder -> null
            is Screen.Home -> studyFolder
            is Screen.Settings -> studyFolder
            is Screen.PenTest -> studyFolder
            is Screen.RevisionLog -> studyFolder
            is Screen.Review -> studyFolder
            is Screen.ShareFolder -> studyFolder
            is Screen.Document -> studyFolder
        }

/** The folder picker for a shared PDF, which is then copied there and opened. */
@Composable
internal fun ShareFolderRoute(
    route: Screen.ShareFolder,
    open: (PdfEntry) -> Unit,
    go: (Screen) -> Unit,
) {
    val activity = checkNotNull(LocalActivity.current) { "the folder picker is shown outside an activity" }
    val scope = rememberCoroutineScope()
    ShareFolderPicker(
        studyFolder = route.studyFolder,
        startFolder = route.startFolder,
        onPick = { folder ->
            PdfCopyIn(activity, scope).start(route.uri, File(route.studyFolder, folder), { copy ->
                open(PdfEntry(copy.path, folder, copy.name))
                go(Screen.Document(route.studyFolder))
            })
        },
        onCancel = { go(Screen.Home(route.studyFolder)) },
    )
}

/** [home], under a line asking for the Document a shared image goes on when [route] has one. */
@Composable
internal fun ChoosingForShare(
    route: Screen.Home,
    go: (Screen) -> Unit,
    home: @Composable () -> Unit,
) {
    Column {
        if (route.sharedImage != null) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(R.string.share_choose_document),
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.weight(1f),
                )
                TextButton(onClick = { go(Screen.Home(route.studyFolder)) }) { Text(stringResource(R.string.cancel)) }
            }
        }
        home()
    }
}
