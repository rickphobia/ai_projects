package com.rickphobia.ricknotes.home

import androidx.annotation.StringRes
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.draganddrop.dragAndDropTarget
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
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
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draganddrop.DragAndDropTarget
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
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
private const val ORPHAN_ALPHA = 0.38f

/** What long-pressing a folder in the tree does. Only settings change: no file is touched. */
interface CourseFolderActions {
    val folders: CourseFolders

    fun mark(folder: String)

    fun unmark(folder: String)
}

/**
 * What a Document long-pressed and dragged out of the tree does: [dragged] gets where the finger or
 * pen is, in the screen's coordinates, and [dropped] where it let go, or null if the drag was
 * cancelled.
 */
class DocumentDrag(
    val dragged: (Offset) -> Unit,
    val dropped: (TreeNode.Document, Offset?) -> Unit,
)

/**
 * What the long-press menu offers on the home screen beside the Course folder mark: each opens its
 * dialog. [newFolder] and [newNotebook] take the tree path of the folder that was long-pressed.
 */
class TreeEditMenu(
    val newFolder: (String) -> Unit,
    val newNotebook: (String) -> Unit,
    val rename: (TreeNode) -> Unit,
    val moveTo: (TreeNode) -> Unit,
    val linkToPdf: (TreeNode.OrphanedInk) -> Unit,
)

/**
 * What tapping opens: a Document, or a Course folder's Revision log by the folder's path (with no
 * [revisionLog], no Revision log row shows). [pdfDrop] makes the target that takes a PDF dropped
 * onto a folder, by the folder's path; with [documentDrag], a Document can be dragged out; with
 * [edits], the long-press menu changes the tree.
 */
class TreeOpens(
    val document: (TreeNode.Document) -> Unit,
    val revisionLog: ((String) -> Unit)?,
    val pdfDrop: ((String) -> DragAndDropTarget)?,
    val documentDrag: DocumentDrag? = null,
    val edits: TreeEditMenu? = null,
)

/**
 * The Study folder tree, on the home screen and in the tree drawer: tap a folder to open or close
 * it, tap a PDF to open it (or long-press and drag it out, where that is offered), long-press a
 * folder to mark or unmark it as a Course folder, drop a PDF onto a folder to copy it in. With
 * [TreeOpens.edits], long-pressing a folder also offers New folder, New Notebook, Rename and Move to…, and
 * long-pressing a Document offers Rename and Move to…; Orphaned ink shows greyed, and tapping or
 * long-pressing it offers Link to PDF…. An open Course folder starts with its
 * Revision log row.
 */
@Composable
fun StudyFolderTree(
    tree: TreeNode.Folder,
    initiallyExpanded: Set<String>,
    courses: CourseFolderActions,
    opens: TreeOpens,
    modifier: Modifier = Modifier,
) {
    val edits = opens.edits
    // Not keyed on the tree: listing it again after an edit keeps the folders that were open.
    var expanded by remember { mutableStateOf(initiallyExpanded) }
    var menuFor by remember { mutableStateOf<String?>(null) }
    val rows = remember(tree, expanded) { TreeLayout.visibleRows(tree, expanded) }

    LazyColumn(modifier = modifier) {
        items(rows, key = { it.node.path }) { row ->
            val node = row.node
            val isCourse = node is TreeNode.Folder && courses.folders.isCourse(node.path)
            val pdfDrop = opens.pdfDrop
            val dropTarget =
                (node as? TreeNode.Folder)?.let { folder -> pdfDrop?.let { remember(folder.path) { it(folder.path) } } }
            val drag = opens.documentDrag?.let { drag -> (node as? TreeNode.Document)?.let { DraggedOut(it, drag) } }
            // Where it can be dragged out, a Document's long-press is left to that.
            val hasMenu = node is TreeNode.Folder || (edits != null && drag == null)
            val showMenu = { menuFor = node.path }.takeIf { hasMenu }
            Box(modifier = Modifier.takingPdfs(dropTarget).draggingOut(drag)) {
                TreeRowContent(
                    row = row,
                    isOpen = node.path in expanded,
                    isCourse = isCourse,
                    onClick = {
                        tapped(node, opens, toggle = { expanded = TreeLayout.toggle(expanded, it) }, showMenu)
                    },
                    onLongClick = showMenu,
                )
                RowMenu(
                    node = node,
                    shown = menuFor == node.path,
                    course = isCourse,
                    actions = RowMenuActions(courses, edits),
                    onDismiss = { menuFor = null },
                )
            }
            HorizontalDivider()
            // An open Course folder's first row is its Revision log, above its own files.
            val revisionLog = opens.revisionLog
            if (isCourse && node.path in expanded && revisionLog != null) {
                Text(
                    text = stringResource(R.string.revision_log),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.primary,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clickable { revisionLog(node.path) }
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

private fun tapped(
    node: TreeNode,
    opens: TreeOpens,
    toggle: (String) -> Unit,
    showMenu: (() -> Unit)?,
) {
    when (node) {
        is TreeNode.Folder -> toggle(node.path)

        is TreeNode.Document -> opens.document(node)

        // Nothing to open: tapping offers Link to PDF…, where the menu has it.
        is TreeNode.OrphanedInk -> showMenu?.invoke()
    }
}

private class RowMenuActions(
    val courses: CourseFolderActions,
    val edits: TreeEditMenu?,
)

/** A row's long-press menu: a folder's Course mark, and the edits where they are offered. */
@Composable
private fun RowMenu(
    node: TreeNode,
    shown: Boolean,
    course: Boolean,
    actions: RowMenuActions,
    onDismiss: () -> Unit,
) {
    val edits = actions.edits
    val choose = { action: () -> Unit ->
        onDismiss()
        action()
    }
    DropdownMenu(expanded = shown, onDismissRequest = onDismiss) {
        if (node is TreeNode.Folder) {
            val courses = actions.courses
            MenuItem(if (course) R.string.unmark_course else R.string.mark_as_course) {
                choose { if (course) courses.unmark(node.path) else courses.mark(node.path) }
            }
            if (edits != null) {
                MenuItem(R.string.new_folder) { choose { edits.newFolder(node.path) } }
                MenuItem(R.string.new_notebook) { choose { edits.newNotebook(node.path) } }
            }
        }
        if (edits != null && node is TreeNode.OrphanedInk) {
            MenuItem(R.string.link_to_pdf) { choose { edits.linkToPdf(node) } }
        } else if (edits != null) {
            MenuItem(R.string.rename) { choose { edits.rename(node) } }
            MenuItem(R.string.move_to) { choose { edits.moveTo(node) } }
        }
    }
}

@Composable
private fun MenuItem(
    @StringRes label: Int,
    onClick: () -> Unit,
) {
    DropdownMenuItem(text = { Text(stringResource(label)) }, onClick = onClick)
}

// Folder rows take dropped PDFs; Documents take nothing.
private fun Modifier.takingPdfs(target: DragAndDropTarget?): Modifier =
    if (target == null) this else dragAndDropTarget(shouldStartDragAndDrop = { true }, target = target)

/** A Document row that can be dragged out of the tree, and what dragging it does. */
private class DraggedOut(
    val document: TreeNode.Document,
    val drag: DocumentDrag,
)

// The drag follows the finger past the tree's edge, so a Document can be dropped beside it.
@Composable
private fun Modifier.draggingOut(dragged: DraggedOut?): Modifier {
    if (dragged == null) return this
    val latest by rememberUpdatedState(dragged)
    var origin by remember { mutableStateOf(Offset.Zero) }
    var at by remember { mutableStateOf<Offset?>(null) }
    return onGloballyPositioned { origin = it.boundsInRoot().topLeft }
        .pointerInput(dragged.document.path) {
            detectDragGesturesAfterLongPress(
                onDragStart = { start -> at = (origin + start).also { latest.drag.dragged(it) } },
                onDragEnd = {
                    latest.drag.dropped(latest.document, at)
                    at = null
                },
                onDragCancel = {
                    latest.drag.dropped(latest.document, null)
                    at = null
                },
                onDrag = { change, amount ->
                    change.consume()
                    at = at?.plus(amount)?.also { latest.drag.dragged(it) }
                },
            )
        }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TreeRowContent(
    row: TreeRow,
    isOpen: Boolean,
    isCourse: Boolean,
    onClick: () -> Unit,
    onLongClick: (() -> Unit)?,
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
        } else if (node is TreeNode.OrphanedInk) {
            // Greyed like a disabled control: the ink is there, its PDF isn't.
            val grey = MaterialTheme.colorScheme.onSurface.copy(alpha = ORPHAN_ALPHA)
            Text(text = node.name, style = style, color = grey)
            Text(
                text = stringResource(R.string.orphaned_ink_label),
                style = typography.labelMedium,
                color = grey,
                modifier = Modifier.padding(start = 8.dp),
            )
        } else {
            Text(text = node.name, style = style)
        }
    }
}
