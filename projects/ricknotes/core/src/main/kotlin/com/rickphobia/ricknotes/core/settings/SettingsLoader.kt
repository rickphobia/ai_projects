package com.rickphobia.ricknotes.core.settings

import com.rickphobia.ricknotes.core.ink.FavouritePens
import com.rickphobia.ricknotes.core.ink.PenColour
import com.rickphobia.ricknotes.core.touch.FingerGestures
import java.nio.file.Files
import java.nio.file.InvalidPathException
import java.nio.file.Path

/** The one place settings are read, validated and saved. */
object SettingsLoader {
    const val STUDY_FOLDER_KEY = "study_folder"
    const val FAVOURITE_PENS_KEY = "favourite_pens"
    const val FINGER_ERASE_KEY = "finger_erase"
    const val TWO_FINGER_TAP_UNDO_KEY = "two_finger_tap_undo"
    const val THREE_FINGER_TAP_REDO_KEY = "three_finger_tap_redo"

    /**
     * The stored finger gestures; a switch never saved is off.
     * @throws InvalidSettingException if a stored switch is neither "true" nor "false".
     */
    fun loadFingerGestures(source: SettingsSource): FingerGestures {
        val defaults = FingerGestures()
        return FingerGestures(
            fingerErase = readSwitch(source, FINGER_ERASE_KEY) ?: defaults.fingerErase,
            twoFingerTapUndo = readSwitch(source, TWO_FINGER_TAP_UNDO_KEY) ?: defaults.twoFingerTapUndo,
            threeFingerTapRedo = readSwitch(source, THREE_FINGER_TAP_REDO_KEY) ?: defaults.threeFingerTapRedo,
        )
    }

    fun saveFingerGestures(
        store: SettingsStore,
        gestures: FingerGestures,
    ) {
        store.write(FINGER_ERASE_KEY, gestures.fingerErase.toString())
        store.write(TWO_FINGER_TAP_UNDO_KEY, gestures.twoFingerTapUndo.toString())
        store.write(THREE_FINGER_TAP_REDO_KEY, gestures.threeFingerTapRedo.toString())
    }

    private fun readSwitch(
        source: SettingsSource,
        key: String,
    ): Boolean? {
        val value = source.read(key) ?: return null
        return value.toBooleanStrictOrNull() ?: throw InvalidSettingException(key, value, "is neither true nor false")
    }

    /** @throws InvalidSettingException if a stored value can't be used. */
    fun load(source: SettingsSource): Settings =
        Settings(
            studyFolder = source.read(STUDY_FOLDER_KEY)?.let(::validateStudyFolder),
        )

    /** Validates [path] and saves it as the Study folder. @throws InvalidSettingException if it can't be used. */
    fun saveStudyFolder(
        store: SettingsStore,
        path: String,
    ) {
        store.write(STUDY_FOLDER_KEY, validateStudyFolder(path))
    }

    /**
     * The stored Favourite pens, or the default list if none were saved.
     * @throws InvalidSettingException if the stored list can't be used.
     */
    fun loadFavouritePens(source: SettingsSource): FavouritePens =
        source.read(FAVOURITE_PENS_KEY)?.let(::parseFavouritePens) ?: FavouritePens.DEFAULT

    /** Saves [pens] as the Favourite pens, stored as colour names in order ("black,red"). */
    fun saveFavouritePens(
        store: SettingsStore,
        pens: FavouritePens,
    ) {
        store.write(FAVOURITE_PENS_KEY, pens.colours.joinToString(",") { it.name.lowercase() })
    }

    private fun parseFavouritePens(value: String): FavouritePens {
        val colours =
            value.split(",").filter { it.isNotBlank() }.map { name ->
                PenColour.entries.firstOrNull { it.name.lowercase() == name.trim() }
                    ?: throw InvalidSettingException(FAVOURITE_PENS_KEY, value, "names an unknown colour \"$name\"")
            }
        val problem =
            when {
                colours.isEmpty() -> "is empty"
                colours.distinct().size != colours.size -> "lists a colour twice"
                else -> null
            }
        if (problem != null) throw InvalidSettingException(FAVOURITE_PENS_KEY, value, problem)
        return FavouritePens(colours)
    }

    // Checked on every start too: the folder can be renamed, deleted or lose its permission
    // between runs, and the app should say so rather than show an empty list.
    private fun validateStudyFolder(value: String): String {
        val path =
            try {
                Path.of(value)
            } catch (e: InvalidPathException) {
                throw invalidStudyFolder(value, "is not a valid path").apply { initCause(e) }
            }
        val problem =
            when {
                !path.isAbsolute -> "is not an absolute path"
                !Files.exists(path) -> "does not exist"
                !Files.isDirectory(path) -> "is not a folder"
                !Files.isReadable(path) -> "can't be read (is \"All files access\" still granted?)"
                else -> null
            }
        if (problem != null) throw invalidStudyFolder(value, problem)
        return value
    }

    private fun invalidStudyFolder(
        value: String,
        reason: String,
    ) = InvalidSettingException(STUDY_FOLDER_KEY, value, reason)
}
