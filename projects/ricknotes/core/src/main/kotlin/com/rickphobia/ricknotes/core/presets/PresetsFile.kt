package com.rickphobia.ricknotes.core.presets

import com.rickphobia.ricknotes.core.session.writeSafely
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path

/** The Presets Send to offers, and why they are the defaults when the file couldn't be used. */
class LoadedPresets(
    val presets: List<Preset>,
    val problem: String?,
)

/**
 * The Presets file, `_ricknotes/presets.json` in the Study folder, so the owner edits it on the
 * laptop and it syncs to the tablet. It is written with the Default Presets when missing and never
 * written again after that.
 */
class PresetsFile(
    studyFolder: Path,
) {
    private val file = studyFolder.resolve(FOLDER).resolve(FILE_NAME)

    /**
     * Reads the Presets, writing the defaults first when the file is missing. A file that can't be
     * read or used gives the defaults and says why, so Send to always works; it is left as it was.
     * Runs file I/O: call it off the main thread.
     */
    fun load(): LoadedPresets {
        if (!Files.exists(file)) return writeDefaults()
        return try {
            // Not Files.readString: Android only has it from API 36.1, and the tablet is on 36.
            LoadedPresets(parse(String(Files.readAllBytes(file), Charsets.UTF_8)), problem = null)
        } catch (e: IOException) {
            fallBack("$FILE_NAME can't be read (${e::class.simpleName})")
        } catch (e: SerializationException) {
            fallBack("$FILE_NAME is not valid Presets JSON: ${e.message?.lineSequence()?.first()}")
        } catch (e: IllegalArgumentException) {
            fallBack("$FILE_NAME can't be used: ${e.message}")
        }
    }

    private fun writeDefaults(): LoadedPresets =
        try {
            Files.createDirectories(file.parent)
            writeSafely(file, json.encodeToString(PresetsJson.serializer(), DEFAULT_PRESETS.toJson()).toByteArray())
            LoadedPresets(DEFAULT_PRESETS, problem = null)
        } catch (e: IOException) {
            fallBack("$FILE_NAME can't be written (${e::class.simpleName})")
        }

    private fun fallBack(problem: String) = LoadedPresets(DEFAULT_PRESETS, "$problem; using the Default Presets")

    private fun parse(text: String): List<Preset> {
        val presets = json.decodeFromString(PresetsJson.serializer(), text).presets
        require(presets.isNotEmpty()) { "it has no Presets" }
        presets.forEach {
            require(it.name.isNotBlank()) { "a Preset has no name" }
            require(it.prompt.isNotBlank()) { "'${it.name}' has no prompt" }
        }
        val repeated = presets.groupBy { it.name }.values.firstOrNull { it.size > 1 }
        require(repeated == null) { "'${repeated?.first()?.name}' is named twice" }
        return presets.map { Preset(it.name, it.prompt, it.inkOn) }
    }

    private fun List<Preset>.toJson() = PresetsJson(map { PresetJson(it.name, it.prompt, it.inkOn) })

    companion object {
        /** The app's own folder in the Study folder, hidden from the tree. */
        const val FOLDER = "_ricknotes"
        const val FILE_NAME = "presets.json"

        private val json =
            Json {
                prettyPrint = true
                encodeDefaults = true
            }
    }
}

@Serializable
private class PresetsJson(
    val presets: List<PresetJson>,
)

@Serializable
private class PresetJson(
    val name: String,
    val prompt: String,
    // Optional, so a hand-written Preset can leave it out.
    val inkOn: Boolean = false,
)
