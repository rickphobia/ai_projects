package com.rickphobia.duitlog

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.content.FileProvider
import com.rickphobia.duitlog.logging.AppLog
import com.rickphobia.duitlog.screens.DuitLogApp
import com.rickphobia.duitlog.screens.DuitLogTheme
import java.io.File
import java.io.IOException

/** Wires the pieces together; the rules live in `core`. */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            DuitLogTheme {
                DuitLogApp(
                    ledger = (application as DuitLogApplication).ledger,
                    versionName = BuildConfig.VERSION_NAME,
                    buildNumber = BuildConfig.VERSION_CODE,
                    onShareLog = ::shareLog,
                )
            }
        }
    }

    /** Copies the log into the shared cache folder and hands it to the Android share menu. */
    private fun shareLog() {
        val copy = File(File(cacheDir, SHARED_DIR), "duit-log-log.txt")
        try {
            AppLog.exportTo(copy)
        } catch (e: IOException) {
            AppLog.e("copying the log for sharing failed", e)
            return
        }
        AppLog.i("sharing the log (${copy.length()} bytes)")
        val uri = FileProvider.getUriForFile(this, "$packageName.files", copy)
        val send =
            Intent(Intent.ACTION_SEND)
                .setType("text/plain")
                .putExtra(Intent.EXTRA_STREAM, uri)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        startActivity(Intent.createChooser(send, getString(R.string.share_log_chooser)))
    }

    private companion object {
        // Must match res/xml/shared_files.xml.
        const val SHARED_DIR = "shared"
    }
}
