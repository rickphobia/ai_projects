package com.rickphobia.ricknotes.core.studyfolder

import com.rickphobia.ricknotes.core.session.InkFileStore
import com.rickphobia.ricknotes.core.session.PictureAssets
import com.rickphobia.ricknotes.core.session.VersionStore
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path

/**
 * The moves that carry the companions of the Document [pdf] to go with it to [target]: its Ink
 * file, its `.assets` folder and its Versions, whichever it has. Another Document's files, and
 * anything in `.versions` not named like one of this Document's Versions, stay where they are.
 */
internal fun companionMoves(
    pdf: Path,
    target: Path,
): List<FileMove> {
    val store = InkFileStore(pdf)
    val ink = store.inkFile
    val targetInk = InkFileStore(target).inkFile
    val assets = PictureAssets(pdf).folder
    return listOfNotNull(
        FileMove(ink, targetInk).takeIf { exists(ink) },
        FileMove(assets, PictureAssets(target).folder).takeIf { exists(assets) },
    ) + conflictCopyMoves(store, InkFileStore(target)) + versionMoves(ink, targetInk)
}

// A Conflict copy keeps what the sync app added to the Ink file's name, so it is still found as one.
private fun conflictCopyMoves(
    store: InkFileStore,
    target: InkFileStore,
): List<FileMove> =
    store.conflictCopies().map { copy ->
        val added = copy.fileName.toString().removePrefix(store.copyStem)
        FileMove(copy, target.inkFile.resolveSibling(target.copyStem + added))
    }

private fun versionMoves(
    ink: Path,
    targetInk: Path,
): List<FileMove> {
    val versions = ink.resolveSibling(VersionStore.FOLDER)
    if (!Files.isDirectory(versions, LinkOption.NOFOLLOW_LINKS)) return emptyList()
    val prefix = "${ink.fileName}."
    val targetVersions = targetInk.resolveSibling(VersionStore.FOLDER)
    val names =
        Files.list(versions).use { files ->
            // Not Stream.toList(): Android only has it from API 34, and core sticks to API 26.
            files
                .iterator()
                .asSequence()
                .map { it.fileName.toString() }
                .toList()
        }
    return names
        .filter { isVersionOf(it, prefix) }
        .sorted()
        .map {
            FileMove(
                versions.resolve(it),
                targetVersions.resolve("${targetInk.fileName}.${it.removePrefix(prefix)}"),
            )
        }
}

// `<ink file name>.<time in ms>.version`, as VersionStore names them.
private fun isVersionOf(
    name: String,
    prefix: String,
) = name.startsWith(prefix) &&
    name.endsWith(VersionStore.SUFFIX) &&
    name.substring(prefix.length, name.length - VersionStore.SUFFIX.length).let { taken ->
        taken.isNotEmpty() && taken.all(Char::isDigit)
    }
