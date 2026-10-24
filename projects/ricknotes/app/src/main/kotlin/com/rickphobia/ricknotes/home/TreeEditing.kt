package com.rickphobia.ricknotes.home

import com.rickphobia.ricknotes.core.studyfolder.TreeEditFailed
import com.rickphobia.ricknotes.core.studyfolder.TreeEditRefused
import com.rickphobia.ricknotes.core.studyfolder.TreeEdits
import com.rickphobia.ricknotes.core.studyfolder.TreeNode
import com.rickphobia.ricknotes.logging.AppLog
import java.nio.file.Path

/** One change to the Study folder asked for from the tree's long-press menu. */
sealed interface TreeEdit {
    data class NewFolder(
        val parent: String,
        val name: String,
    ) : TreeEdit

    data class Rename(
        val node: TreeNode,
        val name: String,
    ) : TreeEdit

    data class Move(
        val node: TreeNode,
        val toFolder: String,
    ) : TreeEdit
}

/** How a [TreeEdit] went. */
sealed interface TreeEditOutcome {
    /** Done: what was at tree path [from] (null for a new folder) is now at [to], carrying [documents]. */
    data class Done(
        val from: String?,
        val to: String,
        val documents: List<String>,
    ) : TreeEditOutcome

    /** Not done, for [message]; [partly] when some files couldn't be moved back. */
    data class NotDone(
        val message: String,
        val partly: Boolean,
    ) : TreeEditOutcome
}

/**
 * What a tree edit needs beside the files: [stillSaving] says whether the ink of a Document (its
 * PDF on disk) is still being saved from a closed Tab, and [followed] makes the Layout, Recent
 * Documents, Course folder marks and reading positions follow a renamed or moved path.
 */
class TreeEditHooks(
    val stillSaving: (Path) -> Boolean,
    val followed: (from: String, to: String, documents: List<String>) -> Unit,
)

/**
 * Runs [edit] with [edits] and logs it with its result, by file names only. Slow on a big folder:
 * call it off the main thread.
 */
fun runTreeEdit(
    edits: TreeEdits,
    edit: TreeEdit,
): TreeEditOutcome {
    val what = describe(edit)
    val documents = edit.edited?.let(::documentsIn).orEmpty()
    return try {
        val to =
            when (edit) {
                is TreeEdit.NewFolder -> edits.newFolder(edit.parent, edit.name)
                is TreeEdit.Rename -> rename(edits, edit.node, edit.name)
                is TreeEdit.Move -> move(edits, edit.node, edit.toFolder)
            }
        AppLog.i("$what: done as ${to.substringAfterLast('/')}")
        TreeEditOutcome.Done(edit.edited?.path, to, documents)
    } catch (e: TreeEditRefused) {
        AppLog.w("$what refused: ${e.message}")
        TreeEditOutcome.NotDone(e.message.orEmpty(), partly = false)
    } catch (e: TreeEditFailed) {
        // No stack trace: the cause's message has full paths in it.
        AppLog.e("$what failed: ${e.message}")
        TreeEditOutcome.NotDone(e.message.orEmpty(), partly = e.notMovedBack.isNotEmpty())
    }
}

private val TreeEdit.edited: TreeNode?
    get() =
        when (this) {
            is TreeEdit.NewFolder -> null
            is TreeEdit.Rename -> node
            is TreeEdit.Move -> node
        }

private fun rename(
    edits: TreeEdits,
    node: TreeNode,
    name: String,
) = when (node) {
    is TreeNode.Document -> edits.renameDocument(node.path, name)
    is TreeNode.Folder -> edits.renameFolder(node.path, name)
}

private fun move(
    edits: TreeEdits,
    node: TreeNode,
    toFolder: String,
) = when (node) {
    is TreeNode.Document -> edits.moveDocument(node.path, toFolder)
    is TreeNode.Folder -> edits.moveFolder(node.path, toFolder)
}

/** The tree paths of [node] if it is a Document, or of every Document inside it. */
fun documentsIn(node: TreeNode): List<String> =
    when (node) {
        is TreeNode.Document -> listOf(node.path)
        is TreeNode.Folder -> node.children.flatMap(::documentsIn)
    }

private fun describe(edit: TreeEdit): String {
    fun kind(node: TreeNode) = if (node is TreeNode.Folder) "folder" else "Document"
    return when (edit) {
        is TreeEdit.NewFolder -> "new folder ${edit.name.trim()} in ${edit.parent.substringAfterLast(
            '/',
        ).ifEmpty { "the Study folder" }}"

        is TreeEdit.Rename -> "rename of ${kind(edit.node)} ${edit.node.name}"

        is TreeEdit.Move -> "move of ${kind(
            edit.node,
        )} ${edit.node.name} to ${edit.toFolder.substringAfterLast('/').ifEmpty { "the Study folder" }}"
    }
}
