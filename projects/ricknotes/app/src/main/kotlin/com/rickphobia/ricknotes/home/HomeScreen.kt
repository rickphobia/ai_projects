package com.rickphobia.ricknotes.home

import androidx.activity.compose.LocalActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draganddrop.DragAndDropTarget
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.studyfolder.StudyFolder
import com.rickphobia.ricknotes.core.studyfolder.TreeNode
import com.rickphobia.ricknotes.files.PdfEntry
import com.rickphobia.ricknotes.imports.PdfDrop
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.nio.file.Path

/**
 * What the home screen reads: the Recent Documents and the Course folder marks from settings, and
 * [dueCount], how many Entries Review has today (slow: it is called off the main thread). [edits]
 * is what a new folder, rename or move needs beside the files.
 */
class HomeLibrary(
    val recentPaths: () -> List<String>,
    val courses: CourseFolderActions,
    val dueCount: () -> Int,
    val edits: TreeEditHooks,
)

/** Where the home screen leads. [openRevisionLog] takes a Course folder relative to the Study folder. */
class HomeNavigation(
    val openSettings: () -> Unit,
    val openPdf: (PdfEntry) -> Unit,
    val openRevisionLog: (String) -> Unit,
    val openReview: () -> Unit,
)

/** Makes, by a folder's tree path, the target that copies a PDF dropped onto it in, then opens it. */
@Composable
private fun rememberPdfDrops(
    folder: StudyFolder,
    openPdf: (PdfEntry) -> Unit,
): (String) -> DragAndDropTarget {
    val activity = checkNotNull(LocalActivity.current) { "the home screen is shown outside an activity" }
    val scope = rememberCoroutineScope()
    return { path ->
        PdfDrop(activity, scope, { folder.resolve(path).toFile() }) { copy ->
            openPdf(PdfEntry(copy.path, path, copy.name))
        }
    }
}

@Composable
fun HomeScreen(
    versionName: String,
    studyFolder: String,
    library: HomeLibrary,
    navigation: HomeNavigation,
) {
    val folder = remember(studyFolder) { StudyFolder(Path.of(studyFolder)) }
    val editing = rememberTreeEditState(studyFolder, library.edits)
    val listing by rememberListing(folder, library.recentPaths, editing.generation)
    // Null until counted; counted again each time the home screen shows, so after Review too.
    val dueCount by produceState<Int?>(initialValue = null, studyFolder) {
        value = withContext(Dispatchers.IO) { library.dueCount() }
    }
    val open = { document: TreeNode.Document ->
        navigation.openPdf(PdfEntry(folder.resolve(document.path).toString(), document.folder, document.name))
    }
    val opens =
        TreeOpens(
            document = open,
            revisionLog = navigation.openRevisionLog,
            pdfDrop = rememberPdfDrops(folder, navigation.openPdf),
            edits = editing.menu,
        )

    Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = stringResource(R.string.app_name), style = MaterialTheme.typography.headlineMedium)
                Text(text = studyFolder, style = MaterialTheme.typography.bodyMedium)
            }
            Text(text = stringResource(R.string.version, versionName), style = MaterialTheme.typography.bodySmall)
            TextButton(onClick = navigation.openSettings) { Text(stringResource(R.string.settings)) }
        }
        // The top of the Study folder has no row to long-press, so it gets its own New folder button.
        val newFolder = { editing.menu.newFolder("") }
        HomeActions(dueCount, navigation.openReview, newFolder.takeIf { listing is Listing.Ready })
        when (val current = listing) {
            Listing.Loading -> {
                Text(stringResource(R.string.listing_pdfs), modifier = Modifier.padding(top = 24.dp))
            }

            is Listing.Failed -> {
                Text(
                    current.message,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(top = 24.dp),
                )
            }

            is Listing.Ready -> {
                HomeTree(current, library.courses, opens)
                editing.dialog?.let {
                    TreeEditDialogs(
                        it,
                        current.tree,
                        onEdit = editing::run,
                    ) { editing.dialog = null }
                }
            }
        }
    }
}

/** Review, with how many Entries are due once counted, and New folder at the top of the tree when offered. */
@Composable
private fun HomeActions(
    dueCount: Int?,
    openReview: () -> Unit,
    newFolder: (() -> Unit)?,
) {
    Row(modifier = Modifier.padding(top = 16.dp), verticalAlignment = Alignment.CenterVertically) {
        Button(onClick = openReview) {
            Text(
                dueCount?.let { pluralStringResource(R.plurals.review_due, it, it) } ?: stringResource(R.string.review),
            )
        }
        if (newFolder != null) {
            TextButton(onClick = newFolder, modifier = Modifier.padding(start = 8.dp)) {
                Text(stringResource(R.string.new_folder))
            }
        }
    }
}

/** The Recent Documents row and the tree, once the Study folder is listed. */
@Composable
private fun HomeTree(
    listing: Listing.Ready,
    courses: CourseFolderActions,
    opens: TreeOpens,
) {
    if (listing.recent.isNotEmpty()) {
        RecentDocumentsRow(listing.recent, onOpen = opens.document, modifier = Modifier.padding(top = 16.dp))
    }
    if (listing.tree.children.isEmpty()) {
        Text(stringResource(R.string.no_pdfs), modifier = Modifier.padding(top = 24.dp))
    } else {
        StudyFolderTree(
            tree = listing.tree,
            initiallyExpanded = listing.initiallyExpanded,
            courses = courses,
            opens = opens,
            modifier = Modifier.padding(top = 16.dp),
        )
    }
}
