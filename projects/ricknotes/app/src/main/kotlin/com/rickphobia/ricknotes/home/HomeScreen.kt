package com.rickphobia.ricknotes.home

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.studyfolder.RecentDocuments
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

private fun list(
    studyFolder: StudyFolder,
    recentPaths: List<String>,
): Listing =
    try {
        val started = System.nanoTime()
        val tree = studyFolder.listTree()
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

@Composable
fun HomeScreen(
    versionName: String,
    studyFolder: String,
    recentDocuments: RecentDocuments,
    onOpenSettings: () -> Unit,
    onOpenPdf: (PdfEntry) -> Unit,
) {
    val folder = remember(studyFolder) { StudyFolder(Path.of(studyFolder)) }
    // A large Study folder takes a moment to walk, so it is listed off the main thread.
    val listing by produceState<Listing>(initialValue = Listing.Loading, studyFolder) {
        value = withContext(Dispatchers.IO) { list(folder, recentDocuments.paths()) }
    }
    val open = { document: TreeNode.Document ->
        recentDocuments.opened(document.path)
        onOpenPdf(
            PdfEntry(
                path = folder.resolve(document.path).toString(),
                folder = document.path.substringBeforeLast('/', missingDelimiterValue = ""),
                name = document.name,
            ),
        )
    }

    Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = stringResource(R.string.app_name), style = MaterialTheme.typography.headlineMedium)
                Text(text = studyFolder, style = MaterialTheme.typography.bodyMedium)
            }
            Text(text = stringResource(R.string.version, versionName), style = MaterialTheme.typography.bodySmall)
            TextButton(onClick = onOpenSettings) { Text(stringResource(R.string.settings)) }
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
                        onOpen = open,
                        modifier = Modifier.padding(top = 16.dp),
                    )
                }
            }
        }
    }
}
