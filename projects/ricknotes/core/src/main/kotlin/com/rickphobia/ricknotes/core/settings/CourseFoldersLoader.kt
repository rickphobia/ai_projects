package com.rickphobia.ricknotes.core.settings

import com.rickphobia.ricknotes.core.studyfolder.CourseFolders

/** Reads, validates and saves the Course folder marks and unmarks, next to the other settings. */
object CourseFoldersLoader {
    const val COURSE_MARKS_KEY = "course_marks"
    const val COURSE_UNMARKS_KEY = "course_unmarks"

    /**
     * The stored marks and unmarks; none saved means only the default depth counts.
     * @throws InvalidSettingException if a stored list can't be used.
     */
    fun load(source: SettingsSource): CourseFolders {
        val marked = source.read(COURSE_MARKS_KEY)?.let { parseFolderList(COURSE_MARKS_KEY, it) }.orEmpty()
        val unmarkedValue = source.read(COURSE_UNMARKS_KEY)
        val unmarked = unmarkedValue?.let { parseFolderList(COURSE_UNMARKS_KEY, it) }.orEmpty()
        val both = marked.intersect(unmarked).firstOrNull()
        if (both != null) {
            throw InvalidSettingException(COURSE_UNMARKS_KEY, unmarkedValue.orEmpty(), "also marks \"$both\"")
        }
        return CourseFolders(marked, unmarked)
    }

    /** Saves [folders] as two lists of tree paths, one per line, since folder names can hold commas. */
    fun save(
        store: SettingsStore,
        folders: CourseFolders,
    ) {
        store.write(COURSE_MARKS_KEY, folders.marked.sorted().joinToString("\n"))
        store.write(COURSE_UNMARKS_KEY, folders.unmarked.sorted().joinToString("\n"))
    }

    private fun parseFolderList(
        key: String,
        value: String,
    ): Set<String> {
        val folders = value.split("\n").filter { it.isNotEmpty() }
        val notAPath =
            folders.firstOrNull { folder ->
                folder.split('/').any { it.isEmpty() || it == "." || it == ".." }
            }
        val problem =
            when {
                notAPath != null -> "holds \"$notAPath\", which is not a folder path in the Study folder"
                folders.distinct().size != folders.size -> "lists a folder twice"
                else -> null
            }
        if (problem != null) throw InvalidSettingException(key, value, problem)
        return folders.toSet()
    }
}
