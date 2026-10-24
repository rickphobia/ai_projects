package com.rickphobia.gloss.settings

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.core.content.edit
import com.rickphobia.gloss.logging.RollingLog
import java.security.GeneralSecurityException
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * The owner's Anthropic key, encrypted with an AES key that never leaves the Android Keystore. Only
 * the ciphertext is written to the app's private storage, which is excluded from backup.
 */
class ApiKeyStore(
    context: Context,
    private val log: RollingLog,
) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun hasKey(): Boolean = prefs.contains(CIPHERTEXT)

    /**
     * The saved key, or null when there is none. A key that can't be decrypted (the Keystore key
     * was lost, as after a phone reset restored over the files) is logged and treated as none, so
     * the owner is asked for it again.
     */
    fun read(): String? {
        val ciphertext = prefs.getString(CIPHERTEXT, null)
        val iv = prefs.getString(IV, null)
        if (ciphertext == null || iv == null) return null
        return try {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, keystoreKey(), GCMParameterSpec(TAG_BITS, decode(iv)))
            String(cipher.doFinal(decode(ciphertext)), Charsets.UTF_8)
        } catch (e: GeneralSecurityException) {
            log.error("couldn't decrypt the saved Anthropic key; asking for it again", e)
            prefs.edit { clear() }
            null
        }
    }

    fun save(apiKey: String) {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, keystoreKey())
        val ciphertext = cipher.doFinal(apiKey.toByteArray(Charsets.UTF_8))
        prefs.edit {
            putString(CIPHERTEXT, encode(ciphertext))
            putString(IV, encode(cipher.iv))
        }
        log.info("Anthropic key saved")
    }

    private fun keystoreKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as SecretKey?)?.let { return it }
        val spec =
            KeyGenParameterSpec
                .Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(KEY_BITS)
                .build()
        return KeyGenerator
            .getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
            .apply { init(spec) }
            .generateKey()
    }

    private fun encode(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)

    private fun decode(text: String): ByteArray = Base64.decode(text, Base64.NO_WRAP)

    private companion object {
        const val PREFS_NAME = "anthropic_key"
        const val CIPHERTEXT = "ciphertext"
        const val IV = "iv"
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val KEY_ALIAS = "gloss-anthropic-key"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val KEY_BITS = 256
        const val TAG_BITS = 128
    }
}
