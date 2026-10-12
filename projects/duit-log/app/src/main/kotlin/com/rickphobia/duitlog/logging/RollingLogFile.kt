package com.rickphobia.duitlog.logging

import java.io.File

/**
 * A log kept as two files in [dir]: the current one, and the previous one it rolled over from.
 * When a line would take the current file past [maxBytes], the current file replaces the previous
 * one and a new current file starts, so the log never takes more than twice [maxBytes].
 */
class RollingLogFile(
    private val dir: File,
    private val maxBytes: Long,
) {
    private val current = File(dir, CURRENT)
    private val old = File(dir, OLD)

    init {
        require(maxBytes > 1) { "maxBytes must be more than 1, was $maxBytes" }
    }

    @Synchronized
    fun append(line: String) {
        val bytes = (line + "\n").toByteArray(Charsets.UTF_8).let { if (it.size > maxBytes) cut(it) else it }
        dir.mkdirs()
        if (current.length() + bytes.size > maxBytes) rotate()
        current.appendBytes(bytes)
    }

    /** Writes the whole log, oldest line first, to [target]. */
    @Synchronized
    fun exportTo(target: File) {
        target.parentFile?.mkdirs()
        target.outputStream().use { out ->
            listOf(old, current).filter { it.exists() }.forEach { file -> file.inputStream().use { it.copyTo(out) } }
        }
    }

    private fun rotate() {
        check(!old.exists() || old.delete()) { "couldn't delete ${old.path}" }
        check(current.renameTo(old)) { "couldn't move ${current.path} to ${old.path}" }
    }

    private fun cut(bytes: ByteArray): ByteArray = bytes.copyOf(maxBytes.toInt() - 1) + '\n'.code.toByte()

    companion object {
        const val CURRENT = "duit-log.log"
        const val OLD = "duit-log.1.log"
    }
}
