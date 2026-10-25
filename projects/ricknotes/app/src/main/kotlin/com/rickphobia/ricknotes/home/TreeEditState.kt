package com.rickphobia.ricknotes.home

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.rickphobia.ricknotes.core.ink.PageBackground
import com.rickphobia.ricknotes.core.studyfolder.CourseFolders
import com.rickphobia.ricknotes.core.studyfolder.NotebookNotCreated
import com.rickphobia.ricknotes.core.studyfolder.Notebooks
import com.rickphobia.ricknotes.core.studyfolder.StudyFolder
import com.rickphobia.ricknotes.core.studyfolder.StudyFolderListingException
import com.rickphobia.ricknotes.core.studyfolder.TreeEdits
import com.rickphobia.ricknotes.core.studyfolder.TreeNode
import com.rickphobia.ricknotes.logging.AppLog
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.nio.file.Path
import java.time.LocalDate

/**
 * The home screen's tree edits: the [dialog] open, if any, and [generation], which counts the
 * edits run so the tree is listed again after each.
 */
class TreeEditState(
    private val edits: TreeEdits,
    private val studyFolder: StudyFolder,
    private val hooks: TreeEditHooks,
    private val scope: CoroutineScope,
    private val notebooks: NotebookMaking,
) {
    var dialog by mutableStateOf<TreeEditDialog?>(null)
    var generation by mutableIntStateOf(0)
        private set

    val menu =
        TreeEditMenu(
            newFolder = { dialog = TreeEditDialog.NewFolder(it) },
            newNotebook = { dialog = TreeEditDialog.NewNotebook(it) },
            rename = { dialog = TreeEditDialog.Rename(it) },
            moveTo = { dialog = TreeEditDialog.MoveTo(it) },
            linkToPdf = ::offerLink,
        )

    // Listing the folder reads the disk, so the dialog opens once its PDFs are known.
    private fun offerLink(orphan: TreeNode.OrphanedInk) {
        scope.launch {
            dialog =
                try {
                    TreeEditDialog.LinkToPdf(
                        orphan,
                        withContext(Dispatchers.IO) { studyFolder.linkCandidates(orphan.path) },
                    )
                } catch (e: StudyFolderListingException) {
                    AppLog.w("PDFs to link Orphaned ink ${orphan.name} to: ${e.cause?.javaClass?.simpleName}")
                    TreeEditDialog.NotDone(TreeEditOutcome.NotDone(e.message.orEmpty(), partly = false))
                }
        }
    }

    val notebookActions = NotebookActions(create = ::createNotebook, name = ::nameNotebook)

    private fun createNotebook(
        folder: String,
        background: PageBackground,
    ) {
        dialog = null
        scope.launch {
            val what = "New Notebook (${background.name.lowercase()}) in ${folder.substringAfterLast('/').ifEmpty {
                "the Study folder"
            }}"
            dialog =
                try {
                    val path =
                        withContext(Dispatchers.IO) {
                            notebooks.maker.create(folder, notebooks.courses(), background, LocalDate.now())
                        }
                    AppLog.i("$what: done as ${path.substringAfterLast('/')}")
                    TreeEditDialog.NameNotebook(TreeNode.Document(path.substringAfterLast('/'), path))
                } catch (e: NotebookNotCreated) {
                    // No stack trace: the cause's message may have full paths in it.
                    AppLog.e("$what failed (PDF made: ${e.pdfMade}): ${e.cause?.javaClass?.simpleName}")
                    TreeEditDialog.NotDone(TreeEditOutcome.NotDone(e.message.orEmpty(), partly = false))
                }
            generation++
        }
    }

    // A rename that is refused leaves the Notebook under its first name and says why.
    private fun nameNotebook(
        notebook: TreeNode.Document,
        name: String,
    ) {
        dialog = null
        if (name == notebook.name) {
            notebooks.open(notebook)
            return
        }
        scope.launch {
            val outcome = withContext(Dispatchers.IO) { runTreeEdit(edits, TreeEdit.Rename(notebook, name)) }
            generation++
            when (outcome) {
                is TreeEditOutcome.Done -> {
                    hooks.followed(notebook.path, outcome.to, outcome.documents)
                    notebooks.open(TreeNode.Document(outcome.to.substringAfterLast('/'), outcome.to))
                }

                is TreeEditOutcome.NotDone -> {
                    dialog = TreeEditDialog.NotDone(outcome)
                }
            }
        }
    }

    /** Runs [edit] off the main thread, then lets the rest of the app follow it or says why not. */
    fun run(edit: TreeEdit) {
        dialog = null
        scope.launch {
            val outcome = withContext(Dispatchers.IO) { runTreeEdit(edits, edit) }
            when (outcome) {
                is TreeEditOutcome.Done -> outcome.from?.let { hooks.followed(it, outcome.to, outcome.documents) }
                is TreeEditOutcome.NotDone -> dialog = TreeEditDialog.NotDone(outcome)
            }
            // Listed again even when not done: a failure may have left something under its new name.
            generation++
        }
    }
}

/**
 * What New Notebook needs: [maker] makes one, [courses] says which folders are Course folders now,
 * and [open] opens the new Notebook in a Tab.
 */
class NotebookMaking(
    val maker: Notebooks,
    val courses: () -> CourseFolders,
    val open: (TreeNode.Document) -> Unit,
)

@Composable
fun rememberTreeEditState(
    studyFolder: String,
    hooks: TreeEditHooks,
    courses: () -> CourseFolders,
    open: (TreeNode.Document) -> Unit,
): TreeEditState {
    val scope = rememberCoroutineScope()
    val scratch = LocalContext.current.cacheDir.toPath()
    val latestCourses by rememberUpdatedState(courses)
    val latestOpen by rememberUpdatedState(open)
    return remember(studyFolder) {
        val root = Path.of(studyFolder)
        val maker = Notebooks(root, scratch, ::writeNotebookPdf)
        val notebooks = NotebookMaking(maker, { latestCourses() }, { latestOpen(it) })
        TreeEditState(TreeEdits(root, hooks.stillSaving), StudyFolder(root), hooks, scope, notebooks)
    }
}
