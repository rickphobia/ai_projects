package com.rickphobia.ricknotes.home

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.studyfolder.TreeLayout
import com.rickphobia.ricknotes.core.studyfolder.TreeNode

private val INDENT_PER_LEVEL = 24.dp
private val MARKER_WIDTH = 24.dp

/** The browse-only Study folder tree: tap a folder to open or close it, tap a PDF to open it. */
@Composable
fun StudyFolderTree(
    tree: TreeNode.Folder,
    initiallyExpanded: Set<String>,
    onOpen: (TreeNode.Document) -> Unit,
    modifier: Modifier = Modifier,
) {
    var expanded by remember(tree) { mutableStateOf(initiallyExpanded) }
    val rows = remember(tree, expanded) { TreeLayout.visibleRows(tree, expanded) }
    val openState = stringResource(R.string.folder_open)
    val closedState = stringResource(R.string.folder_closed)

    LazyColumn(modifier = modifier) {
        items(rows, key = { it.node.path }) { row ->
            val node = row.node
            val isOpen = node.path in expanded
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clickable {
                            when (node) {
                                is TreeNode.Folder -> expanded = TreeLayout.toggle(expanded, node.path)
                                is TreeNode.Document -> onOpen(node)
                            }
                        }.semantics {
                            if (node is TreeNode.Folder) {
                                stateDescription =
                                    if (isOpen) openState else closedState
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
                Text(text = node.name, style = style)
            }
            HorizontalDivider()
        }
    }
}
