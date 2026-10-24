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
 * [dueCount], how many Entries Review has today (slow: it is called off the main thread).
 */
class HomeLibrary(
    val recentPaths: () -> List<String>,
    val courses: CourseFolderActions,
    val dueCount: () -> Int,
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
    val listing by rememberListing(folder, library.recentPaths)
    // Null until counted; counted again each time the home screen shows, so after Review too.
    val dueCount by produceState<Int?>(initialValue = null, studyFolder) {
        value = withContext(Dispatchers.IO) { library.dueCount() }
    }
    val open = { document: TreeNode.Document ->
        navigation.openPdf(PdfEntry(folder.resolve(document.path).toString(), document.folder, document.name))
    }
    val pdfDrop = rememberPdfDrops(folder, navigation.openPdf)

    Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = stringResource(R.string.app_name), style = MaterialTheme.typography.headlineMedium)
                Text(text = studyFolder, style = MaterialTheme.typography.bodyMedium)
            }
            Text(text = stringResource(R.string.version, versionName), style = MaterialTheme.typography.bodySmall)
            TextButton(onClick = navigation.openSettings) { Text(stringResource(R.string.settings)) }
        }
        Button(onClick = navigation.openReview, modifier = Modifier.padding(top = 16.dp)) {
            Text(
                dueCount?.let { pluralStringResource(R.plurals.review_due, it, it) } ?: stringResource(R.string.review),
            )
        }
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
                if (current.recent.isNotEmpty()) {
                    RecentDocumentsRow(current.recent, onOpen = open, modifier = Modifier.padding(top = 16.dp))
                }
                if (current.tree.children.isEmpty()) {
                    Text(stringResource(R.string.no_pdfs), modifier = Modifier.padding(top = 24.dp))
                } else {
                    StudyFolderTree(
                        tree = current.tree,
                        initiallyExpanded = current.initiallyExpanded,
                        courses = library.courses,
                        opens = TreeOpens(document = open, revisionLog = navigation.openRevisionLog, pdfDrop = pdfDrop),
                        modifier = Modifier.padding(top = 16.dp),
                    )
                }
            }
        }
    }
}
