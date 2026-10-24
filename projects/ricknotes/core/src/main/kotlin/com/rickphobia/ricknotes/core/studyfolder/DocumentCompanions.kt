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
    val ink = InkFileStore(pdf).inkFile
    val targetInk = InkFileStore(target).inkFile
    val assets = PictureAssets(pdf).folder
    return listOfNotNull(
        FileMove(ink, targetInk).takeIf { exists(ink) },
        FileMove(assets, PictureAssets(target).folder).takeIf { exists(assets) },
    ) + versionMoves(ink, targetInk)
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
