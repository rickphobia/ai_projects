package com.rickphobia.ricknotes.core.studyfolder

import java.io.IOException
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path

/** Moves one file or folder to a name that is free; never replaces anything. */
typealias FileMover = (from: Path, to: Path) -> Unit

internal val moveWithoutReplacing: FileMover = { from, to -> Files.move(from, to) }

/** One file or folder of a tree edit, and where it goes. */
internal class FileMove(
    val from: Path,
    val to: Path,
)

internal fun exists(path: Path) = Files.exists(path, LinkOption.NOFOLLOW_LINKS)

/**
 * Refuses a move onto a name that is taken. A case-only rename finds its own file on a
 * case-insensitive disk; that is no clash.
 */
internal fun refuseIfTaken(move: FileMove) {
    if (!exists(move.to)) return
    if (exists(move.from) && Files.isSameFile(move.from, move.to)) return
    throw TreeEditRefused("${move.to.fileName} already exists")
}

/**
 * Makes [moves] in order with [mover]. When one fails, the ones done are moved back, newest
 * first, and the error names the one that failed and any that couldn't go back.
 *
 * @throws TreeEditFailed
 */
internal fun runAll(
    moves: List<FileMove>,
    mover: FileMover,
) {
    val done = mutableListOf<FileMove>()
    for (move in moves) {
        try {
            // Only the `.versions` folder can be missing. It is left behind on failure, which is
            // harmless: it is hidden, and the next Version would make it anyway.
            Files.createDirectories(move.to.parent)
            mover(move.from, move.to)
            done += move
        } catch (e: IOException) {
            throw TreeEditFailed(move.from.fileName.toString(), moveBack(done, mover), e)
        } catch (e: SecurityException) {
            throw TreeEditFailed(move.from.fileName.toString(), moveBack(done, mover), e)
        }
    }
}

// The names that couldn't go back, so the error can say where they are.
private fun moveBack(
    done: List<FileMove>,
    mover: FileMover,
): List<String> =
    done.reversed().mapNotNull { move ->
        try {
            mover(move.to, move.from)
            null
        } catch (_: IOException) {
            move.to.fileName.toString()
        } catch (_: SecurityException) {
            // Named in the error rather than thrown, so the first failure isn't lost.
            move.to.fileName.toString()
        }
    }
