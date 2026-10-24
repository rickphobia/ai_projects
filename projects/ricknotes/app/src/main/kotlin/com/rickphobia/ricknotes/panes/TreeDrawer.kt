package com.rickphobia.ricknotes.panes

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.studyfolder.StudyFolder
import com.rickphobia.ricknotes.home.CourseFolderActions
import com.rickphobia.ricknotes.home.Listing
import com.rickphobia.ricknotes.home.StudyFolderTree
import com.rickphobia.ricknotes.home.TreeOpens
import com.rickphobia.ricknotes.home.rememberListing
import java.nio.file.Path

// Wide enough for a Course folder's Documents, narrow enough to leave most of a Pane to drop on.
private val DRAWER_WIDTH = 360.dp

/** What the tree drawer lists as the home screen does: Recent Documents, and the Course folder marks. */
internal class TreeSource(
    val recentPaths: () -> List<String>,
    val courses: CourseFolderActions,
)

/**
 * The Study folder tree in a drawer over the Document screen's start edge, opening on the same
 * semester as the home screen's. It is walked again each time the drawer opens.
 */
@Composable
internal fun TreeDrawer(
    studyFolder: String,
    source: TreeSource,
    opens: TreeOpens,
    close: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val folder = remember(studyFolder) { StudyFolder(Path.of(studyFolder)) }
    val listing by rememberListing(folder, source.recentPaths)
    Surface(
        shadowElevation = 8.dp,
        tonalElevation = 1.dp,
        modifier = modifier.width(DRAWER_WIDTH).fillMaxHeight(),
    ) {
        Column(modifier = Modifier.padding(horizontal = 16.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    stringResource(R.string.study_folder),
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = close) {
                    Icon(painterResource(R.drawable.ic_close), contentDescription = stringResource(R.string.close_tree))
                }
            }
            when (val current = listing) {
                Listing.Loading -> {
                    Text(stringResource(R.string.listing_pdfs))
                }

                is Listing.Failed -> {
                    Text(current.message, color = MaterialTheme.colorScheme.error)
                }

                is Listing.Ready -> {
                    if (current.tree.children.isEmpty()) {
                        Text(stringResource(R.string.no_pdfs))
                    } else {
                        StudyFolderTree(current.tree, current.initiallyExpanded, source.courses, opens)
                    }
                }
            }
        }
    }
}
