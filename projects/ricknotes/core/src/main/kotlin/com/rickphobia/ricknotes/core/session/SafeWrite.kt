package com.rickphobia.ricknotes.core.session

import java.io.FileOutputStream
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption

/** Temporary files start with "." and end with this: the pattern the sync app is told to skip. */
const val TEMPORARY_SUFFIX = ".tmp"

/** The hidden temporary file [target] is written through: `.<name>.tmp` in the same folder. */
internal fun temporaryFileFor(target: Path): Path = target.resolveSibling(".${target.fileName}$TEMPORARY_SUFFIX")

/**
 * Replaces [target] with [bytes] safely: writes the hidden temporary file beside it, flushes it to
 * disk, then renames it over [target] in one step, so a crash mid-write leaves the old file whole.
 * A temporary file left by an interrupted write is simply written over.
 *
 * @throws IOException if any step fails; [target] is then as it was before.
 */
internal fun writeSafely(
    target: Path,
    bytes: ByteArray,
) {
    val temporary = temporaryFileFor(target)
    FileOutputStream(temporary.toFile()).use { out ->
        out.write(bytes)
        out.fd.sync()
    }
    Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
}

/**
 * Copies [source] to [target] the same way as [writeSafely], streaming so a big PDF isn't held in
 * memory. [source] is only read. If a step fails, the temporary file is removed.
 *
 * @throws IOException if any step fails; [target] is then as it was before.
 */
internal fun copySafely(
    source: Path,
    target: Path,
) {
    val temporary = temporaryFileFor(target)
    try {
        FileOutputStream(temporary.toFile()).use { out ->
            Files.copy(source, out)
            out.fd.sync()
        }
        Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
    } catch (e: IOException) {
        Files.deleteIfExists(temporary)
        throw e
    }
}
