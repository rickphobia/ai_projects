package com.rickphobia.ricknotes.home

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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.studyfolder.StudyFolder
import com.rickphobia.ricknotes.core.studyfolder.StudyFolderListingException
import com.rickphobia.ricknotes.core.studyfolder.TreeLayout
import com.rickphobia.ricknotes.core.studyfolder.TreeNode
import com.rickphobia.ricknotes.files.PdfEntry
import com.rickphobia.ricknotes.logging.AppLog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.nio.file.Path

/** What the home screen shows once the Study folder has been walked. */
private sealed interface Listing {
    data object Loading : Listing

    data class Ready(
        val tree: TreeNode.Folder,
        val recent: List<TreeNode.Document>,
        val initiallyExpanded: Set<String>,
    ) : Listing

    data class Failed(
        val message: String,
    ) : Listing
}

private fun loadListing(
    studyFolder: StudyFolder,
    recentPaths: List<String>,
): Listing =
    try {
        val started = System.nanoTime()
        val tree = studyFolder.listTree { _, error -> AppLog.w("left out of the tree: ${error.message}") }
        AppLog.i("listed the Study folder in ${(System.nanoTime() - started) / NANOS_PER_MS} ms")
        Listing.Ready(
            tree = tree,
            recent = TreeLayout.documents(tree, recentPaths),
            initiallyExpanded = TreeLayout.initiallyExpanded(tree, recentPaths),
        )
    } catch (e: StudyFolderListingException) {
        AppLog.e("listing the Study folder failed", e)
        Listing.Failed(e.message.orEmpty())
    }

private const val NANOS_PER_MS = 1_000_000

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

@Composable
fun HomeScreen(
    versionName: String,
    studyFolder: String,
    library: HomeLibrary,
    navigation: HomeNavigation,
) {
    val folder = remember(studyFolder) { StudyFolder(Path.of(studyFolder)) }
    // A large Study folder takes a moment to walk, so it is listed off the main thread.
    val listing by produceState<Listing>(initialValue = Listing.Loading, studyFolder) {
        value = withContext(Dispatchers.IO) { loadListing(folder, library.recentPaths()) }
    }
    // Null until counted; counted again each time the home screen shows, so after Review too.
    val dueCount by produceState<Int?>(initialValue = null, studyFolder) {
        value = withContext(Dispatchers.IO) { library.dueCount() }
    }
    val open = { document: TreeNode.Document ->
        navigation.openPdf(PdfEntry(folder.resolve(document.path).toString(), document.folder, document.name))
    }

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
                        opens = TreeOpens(document = open, revisionLog = navigation.openRevisionLog),
                        modifier = Modifier.padding(top = 16.dp),
                    )
                }
            }
        }
    }
}
