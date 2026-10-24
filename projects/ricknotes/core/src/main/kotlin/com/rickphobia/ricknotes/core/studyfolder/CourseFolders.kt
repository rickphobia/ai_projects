package com.rickphobia.ricknotes.core.studyfolder

/**
 * Which folders are Course folders. A folder three levels inside the Study folder
 * (`Y1/Sem1/EE2001`) is one unless it is in [unmarked]; any folder in [marked] is one too.
 * Folders are named by tree path. Changing a mark only changes these lists, never any files.
 */
data class CourseFolders(
    val marked: Set<String> = emptySet(),
    val unmarked: Set<String> = emptySet(),
) {
    fun isCourse(folder: String): Boolean = folder in marked || (depthOf(folder) == COURSE_DEPTH && folder !in unmarked)

    /** The nearest Course folder at or above [folder], or null when it is in no course. */
    fun courseFolderOf(folder: String): String? =
        generateSequence(folder.takeIf { it.isNotEmpty() }) { parentOf(it) }.firstOrNull(::isCourse)

    /** The Course folder of the Document at tree [path], or null when it is in no course. */
    fun courseFolderOfDocument(path: String): String? = parentOf(path)?.let(::courseFolderOf)

    /** These folders with [folder] made a Course folder. Only lists a folder the default leaves out. */
    fun mark(folder: String): CourseFolders =
        if (depthOf(folder) == COURSE_DEPTH) copy(unmarked = unmarked - folder) else copy(marked = marked + folder)

    /** These folders with [folder] no longer a Course folder. */
    fun unmark(folder: String): CourseFolders =
        if (depthOf(folder) == COURSE_DEPTH) {
            copy(marked = marked - folder, unmarked = unmarked + folder)
        } else {
            copy(marked = marked - folder)
        }

    /** These folders with every mark on or inside the folder [from] carried to [to]. */
    fun renamed(
        from: String,
        to: String,
    ): CourseFolders =
        CourseFolders(
            marked = marked.mapTo(mutableSetOf()) { renamedPath(it, from, to) ?: it },
            unmarked = unmarked.mapTo(mutableSetOf()) { renamedPath(it, from, to) ?: it },
        )

    companion object {
        // Year → Sem → course.
        const val COURSE_DEPTH = 3

        fun depthOf(folder: String) = if (folder.isEmpty()) 0 else folder.count { it == '/' } + 1

        private fun parentOf(path: String): String? = if ('/' in path) path.substringBeforeLast('/') else null
    }
}
