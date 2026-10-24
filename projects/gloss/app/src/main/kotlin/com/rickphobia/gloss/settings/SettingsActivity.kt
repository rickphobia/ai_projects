package com.rickphobia.gloss.settings

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.runtime.LaunchedEffect
import androidx.core.content.FileProvider
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.rickphobia.gloss.GlossApplication
import com.rickphobia.gloss.R
import com.rickphobia.gloss.card.GlossTheme
import java.io.File

/** Gloss's launcher screen: the first-run key screen, then Settings. */
class SettingsActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val app = application as GlossApplication
        val openedForKey = intent.getBooleanExtra(EXTRA_CHANGE_KEY, false)
        val settings: SettingsViewModel by viewModels {
            viewModelFactory {
                initializer { SettingsViewModel(app.apiKeys, app.anthropic, PhoneSettings.DEFINE_MODEL, openedForKey) }
            }
        }
        setContent {
            // Opened from the card to fix the key: go straight back to it, where Retry waits.
            LaunchedEffect(settings.keySaved) { if (settings.keySaved && openedForKey) finish() }
            GlossTheme {
                SettingsScreen(
                    hasKey = settings.hasKey,
                    enteringKey = settings.enteringKey,
                    checkingKey = settings.checkingKey,
                    keyProblem = settings.keyProblem,
                    onSaveKey = settings::saveKey,
                    onChangeKey = settings::changeKey,
                    onCancelKeyEntry = settings::cancelKeyEntry,
                    onShareLog = { shareLog(app) },
                )
            }
        }
    }

    private fun shareLog(app: GlossApplication) {
        val file = app.log.exportTo(File(cacheDir, "logs/gloss-log.txt"))
        val uri = FileProvider.getUriForFile(this, "$packageName.logs", file)
        val send =
            Intent(Intent.ACTION_SEND)
                .setType("text/plain")
                .putExtra(Intent.EXTRA_STREAM, uri)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        app.log.info("log shared")
        startActivity(Intent.createChooser(send, getString(R.string.share_log)))
    }

    companion object {
        private const val EXTRA_CHANGE_KEY = "com.rickphobia.gloss.CHANGE_KEY"

        /** Opens the screen at the key box, as the card's Add key and Change key buttons do. */
        fun changeKeyIntent(context: Context): Intent =
            Intent(context, SettingsActivity::class.java).putExtra(EXTRA_CHANGE_KEY, true)
    }
}
