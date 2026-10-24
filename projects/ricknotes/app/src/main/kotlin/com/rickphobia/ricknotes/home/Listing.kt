package com.rickphobia.ricknotes.home

import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.produceState
import com.rickphobia.ricknotes.core.studyfolder.StudyFolder
import com.rickphobia.ricknotes.core.studyfolder.StudyFolderListingException
import com.rickphobia.ricknotes.core.studyfolder.TreeLayout
import com.rickphobia.ricknotes.core.studyfolder.TreeNode
import com.rickphobia.ricknotes.logging.AppLog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** The Study folder tree once walked, for the home screen and the tree drawer alike. */
sealed interface Listing {
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
 * [folder]'s tree, opening on the semester of the most recent of [recentPaths]. A large Study
 * folder takes a moment to walk, so it is listed off the main thread. A new [generation] lists it
 * again, after the tree was changed.
 */
@Composable
fun rememberListing(
    folder: StudyFolder,
    recentPaths: () -> List<String>,
    generation: Int = 0,
): State<Listing> =
    produceState<Listing>(initialValue = Listing.Loading, folder, generation) {
        value = withContext(Dispatchers.IO) { loadListing(folder, recentPaths()) }
    }
