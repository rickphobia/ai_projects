package com.rickphobia.ricknotes.home

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.studyfolder.CourseFolders
import com.rickphobia.ricknotes.core.studyfolder.TreeLayout
import com.rickphobia.ricknotes.core.studyfolder.TreeNode
import com.rickphobia.ricknotes.core.studyfolder.TreeRow

private val INDENT_PER_LEVEL = 24.dp
private val MARKER_WIDTH = 24.dp

/** What long-pressing a folder in the tree does. Only settings change: no file is touched. */
interface CourseFolderActions {
    val folders: CourseFolders

    fun mark(folder: String)

    fun unmark(folder: String)
}

/** What tapping opens: a Document, or a Course folder's Revision log by the folder's path. */
class TreeOpens(
    val document: (TreeNode.Document) -> Unit,
    val revisionLog: (String) -> Unit,
)

/**
 * The browse-only Study folder tree: tap a folder to open or close it, tap a PDF to open it,
 * long-press a folder to mark or unmark it as a Course folder. An open Course folder starts with
 * its Revision log row.
 */
@Composable
fun StudyFolderTree(
    tree: TreeNode.Folder,
    initiallyExpanded: Set<String>,
    courses: CourseFolderActions,
    opens: TreeOpens,
    modifier: Modifier = Modifier,
) {
    var expanded by remember(tree) { mutableStateOf(initiallyExpanded) }
    var menuFor by remember { mutableStateOf<String?>(null) }
    val rows = remember(tree, expanded) { TreeLayout.visibleRows(tree, expanded) }

    LazyColumn(modifier = modifier) {
        items(rows, key = { it.node.path }) { row ->
            val node = row.node
            val isCourse = node is TreeNode.Folder && courses.folders.isCourse(node.path)
            Box {
                TreeRowContent(
                    row = row,
                    isOpen = node.path in expanded,
                    isCourse = isCourse,
                    onClick = {
                        when (node) {
                            is TreeNode.Folder -> expanded = TreeLayout.toggle(expanded, node.path)
                            is TreeNode.Document -> opens.document(node)
                        }
                    },
                    onLongClick = { if (node is TreeNode.Folder) menuFor = node.path },
                )
                DropdownMenu(expanded = menuFor == node.path, onDismissRequest = { menuFor = null }) {
                    val label = if (isCourse) R.string.unmark_course else R.string.mark_as_course
                    DropdownMenuItem(
                        text = { Text(stringResource(label)) },
                        onClick = {
                            menuFor = null
                            if (isCourse) courses.unmark(node.path) else courses.mark(node.path)
                        },
                    )
                }
            }
            HorizontalDivider()
            // An open Course folder's first row is its Revision log, above its own files.
            if (isCourse && node.path in expanded) {
                Text(
                    text = stringResource(R.string.revision_log),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.primary,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clickable { opens.revisionLog(node.path) }
                            .padding(
                                start = INDENT_PER_LEVEL * (row.depth + 1) + MARKER_WIDTH,
                                top = 10.dp,
                                bottom = 10.dp,
                            ),
                )
                HorizontalDivider()
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TreeRowContent(
    row: TreeRow,
    isOpen: Boolean,
    isCourse: Boolean,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
) {
    val node = row.node
    val openState = stringResource(R.string.folder_open)
    val closedState = stringResource(R.string.folder_closed)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .combinedClickable(onClick = onClick, onLongClick = onLongClick)
                .semantics {
                    if (node is TreeNode.Folder) {
                        stateDescription = if (isOpen) openState else closedState
                    }
                }.padding(start = INDENT_PER_LEVEL * row.depth, top = 10.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val marker =
            when {
                node !is TreeNode.Folder -> ""
                isOpen -> "▾"
                else -> "▸"
            }
        Text(text = marker, modifier = Modifier.width(MARKER_WIDTH))
        val typography = MaterialTheme.typography
        val style = if (node is TreeNode.Folder) typography.titleMedium else typography.bodyLarge
        if (isCourse) {
            val colour = MaterialTheme.colorScheme.primary
            Text(text = node.name, style = style, fontWeight = FontWeight.Bold, color = colour)
            Text(
                text = stringResource(R.string.course_label),
                style = typography.labelMedium,
                color = colour,
                modifier = Modifier.padding(start = 8.dp),
            )
        } else {
            Text(text = node.name, style = style)
        }
    }
}
