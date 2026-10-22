package com.rickphobia.ricknotes.core.settings

/** The app's settings after loading and validation. A null field means "not chosen yet". */
data class Settings(
    val studyFolder: String?,
)

/** Where stored settings are read from: the app's private storage, or a map in tests. */
fun interface SettingsSource {
    fun read(key: String): String?
}

/**
 * Where settings are saved to. Only [SettingsLoader] writes, after validating the value, except
 * for the Recent Documents list, which `RecentDocuments` keeps and reads leniently.
 */
fun interface SettingsStore {
    fun write(
        key: String,
        value: String,
    )
}

/**
 * A setting that can't be used. [key] names the setting, [value] is what was stored or picked,
 * and [reason] says why in words the app can show ("does not exist").
 */
class InvalidSettingException(
    val key: String,
    val value: String,
    val reason: String,
) : IllegalArgumentException("Setting '$key' = '$value' $reason")
