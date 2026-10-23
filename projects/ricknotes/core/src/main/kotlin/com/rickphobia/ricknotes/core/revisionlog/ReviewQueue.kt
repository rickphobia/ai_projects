package com.rickphobia.ricknotes.core.revisionlog

import java.io.IOException
import java.nio.file.FileVisitResult
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.SimpleFileVisitor
import java.nio.file.attribute.BasicFileAttributes

/** One course's due Entries in Review, oldest due first. [courseFolder] is relative to the Study folder. */
class DueCourse(
    val courseFolder: String,
    val session: RevisionLogSession,
    val entries: List<Entry>,
)

/** Told about each folder [ReviewQueue] couldn't search, so one odd folder doesn't hide the rest. */
typealias UnsearchableFolderListener = (folder: Path, error: IOException) -> Unit

/** Every due Entry in the Study folder, one course at a time (spec, "Review queue"). */
object ReviewQueue {
    private const val ASSETS_SUFFIX = ".assets"

    /**
     * Every course with something due today, by Course folder path. [open] gives the Revision log
     * session of a Course folder: the app's one per folder, so rating here never races adding
     * from a Document. Walks the whole Study folder, so call it off the main thread.
     */
    fun due(
        studyFolder: Path,
        open: (Path) -> RevisionLogSession,
        onUnsearchable: UnsearchableFolderListener,
    ): List<DueCourse> =
        courseFoldersWithLogs(studyFolder, onUnsearchable)
            .map { folder -> open(folder).let { DueCourse(relative(studyFolder, folder), it, it.due()) } }
            .filter { it.entries.isNotEmpty() }
            .sortedBy { it.courseFolder }

    /**
     * The folders under [studyFolder] holding a Revision log folder, at any depth: a folder that
     * is no longer a Course folder still has its Entries reviewed (spec, story 4).
     */
    fun courseFoldersWithLogs(
        studyFolder: Path,
        onUnsearchable: UnsearchableFolderListener,
    ): List<Path> {
        val found = mutableListOf<Path>()
        Files.walkFileTree(
            studyFolder,
            object : SimpleFileVisitor<Path>() {
                override fun preVisitDirectory(
                    dir: Path,
                    attrs: BasicFileAttributes,
                ): FileVisitResult {
                    val name = dir.fileName?.toString().orEmpty()
                    return when {
                        dir == studyFolder -> {
                            FileVisitResult.CONTINUE
                        }

                        name == RevisionLogSession.FOLDER -> {
                            found.add(dir.parent)
                            FileVisitResult.SKIP_SUBTREE
                        }

                        // `.versions`, other apps' hidden folders, and Pictures never hold a log.
                        name.startsWith(".") || name.endsWith(ASSETS_SUFFIX) -> {
                            FileVisitResult.SKIP_SUBTREE
                        }

                        else -> {
                            FileVisitResult.CONTINUE
                        }
                    }
                }

                override fun visitFileFailed(
                    file: Path,
                    exc: IOException,
                ): FileVisitResult {
                    onUnsearchable(file, exc)
                    return FileVisitResult.CONTINUE
                }

                // A folder that fails halfway through its listing is reported, not thrown.
                override fun postVisitDirectory(
                    dir: Path,
                    exc: IOException?,
                ): FileVisitResult {
                    exc?.let { onUnsearchable(dir, it) }
                    return FileVisitResult.CONTINUE
                }
            },
        )
        return found.sorted()
    }

    private fun relative(
        studyFolder: Path,
        folder: Path,
    ): String = studyFolder.relativize(folder).joinToString("/")
}
