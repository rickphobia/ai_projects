package com.rickphobia.ricknotes.core.studyfolder

/** One row the home screen shows: a tree entry, indented by [depth] (0 for the Study folder's own entries). */
data class TreeRow(
    val node: TreeNode,
    val depth: Int,
)

/** Which folders of the Study folder tree are open, and the rows that makes. Folders are named by tree path. */
object TreeLayout {
    // Year → Sem: the second level of the Study folder.
    private const val SEMESTER_DEPTH = 2

    /**
     * The folders open when the home screen appears: the year and semester of the most recent
     * Document still in the tree, or else the last semester of the last year.
     */
    fun initiallyExpanded(
        tree: TreeNode.Folder,
        recentPaths: List<String>,
    ): Set<String> {
        val folders = folderPaths(tree)
        val recentSemester =
            recentPaths
                .map { it.split('/') }
                .filter { it.size > SEMESTER_DEPTH }
                .map { it.take(SEMESTER_DEPTH).joinToString("/") }
                .firstOrNull { it in folders }
        return if (recentSemester != null) {
            setOf(recentSemester.substringBefore('/'), recentSemester)
        } else {
            lastSemester(tree)
        }
    }

    private fun lastSemester(tree: TreeNode.Folder): Set<String> {
        val lastYear = tree.children.filterIsInstance<TreeNode.Folder>().lastOrNull() ?: return emptySet()
        val lastSemester = lastYear.children.filterIsInstance<TreeNode.Folder>().lastOrNull()
        return setOfNotNull(lastYear.path, lastSemester?.path)
    }

    /** The rows on screen: every entry whose folders above it are all open. */
    fun visibleRows(
        tree: TreeNode.Folder,
        expanded: Set<String>,
    ): List<TreeRow> {
        val rows = mutableListOf<TreeRow>()

        fun addChildren(
            folder: TreeNode.Folder,
            depth: Int,
        ) {
            folder.children.forEach { child ->
                rows.add(TreeRow(child, depth))
                if (child is TreeNode.Folder && child.path in expanded) addChildren(child, depth + 1)
            }
        }
        addChildren(tree, 0)
        return rows
    }

    /** [expanded] with [folder] opened if it was closed, or closed if it was open. */
    fun toggle(
        expanded: Set<String>,
        folder: String,
    ): Set<String> = if (folder in expanded) expanded - folder else expanded + folder

    /** The Documents at [paths] that are still in the tree, in the order of [paths]. */
    fun documents(
        tree: TreeNode.Folder,
        paths: List<String>,
    ): List<TreeNode.Document> {
        val byPath = allNodes(tree).filterIsInstance<TreeNode.Document>().associateBy { it.path }
        return paths.mapNotNull { byPath[it] }
    }

    private fun folderPaths(tree: TreeNode.Folder): Set<String> =
        allNodes(tree).filterIsInstance<TreeNode.Folder>().map { it.path }.toSet()

    private fun allNodes(folder: TreeNode.Folder): Sequence<TreeNode> =
        folder.children.asSequence().flatMap { child ->
            if (child is TreeNode.Folder) sequenceOf(child) + allNodes(child) else sequenceOf(child)
        }
}
