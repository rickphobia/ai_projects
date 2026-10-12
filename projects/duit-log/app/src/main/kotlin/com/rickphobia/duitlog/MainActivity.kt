package com.rickphobia.duitlog

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.core.content.FileProvider
import com.rickphobia.duitlog.capture.RecorderScreen
import com.rickphobia.duitlog.capture.walletAppsOnPhone
import com.rickphobia.duitlog.logging.AppLog
import com.rickphobia.duitlog.onboarding.FirstRun
import com.rickphobia.duitlog.onboarding.GuideState
import com.rickphobia.duitlog.onboarding.NotificationAccess
import com.rickphobia.duitlog.onboarding.NotificationAccessGuide
import com.rickphobia.duitlog.screens.DuitLogTheme
import com.rickphobia.duitlog.screens.HomeScreen
import java.io.File
import java.io.IOException
import java.time.ZoneId

/** Wires the pieces together; the rules live in `core`. */
class MainActivity : ComponentActivity() {
    private enum class Destination { GUIDE, HOME, RECORDER }

    // Re-read on every resume: the user grants these in Android's settings, outside the app.
    private var accessGranted by mutableStateOf(false)
    private var notificationsAllowed by mutableStateOf(false)

    private val askToPostNotifications =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            AppLog.i("permission to post notifications ${if (granted) "granted" else "refused"}")
            notificationsAllowed = granted
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val firstRun = FirstRun(this)
        setContent {
            DuitLogTheme {
                var destination by rememberSaveable {
                    mutableStateOf(if (firstRun.guideSeen) Destination.HOME else Destination.GUIDE)
                }
                BackHandler(enabled = destination != Destination.HOME) { destination = Destination.HOME }
                when (destination) {
                    Destination.GUIDE -> {
                        Guide(onDone = {
                            firstRun.markGuideSeen()
                            destination = Destination.HOME
                        })
                    }

                    Destination.HOME -> {
                        HomeScreen(
                            versionName = BuildConfig.VERSION_NAME,
                            buildNumber = BuildConfig.VERSION_CODE,
                            accessGranted = accessGranted,
                            onFixAccess = { NotificationAccess.openSettings(this) },
                            onOpenRecorder = { destination = Destination.RECORDER },
                            onOpenGuide = { destination = Destination.GUIDE },
                            onShareLog = ::shareLog,
                        )
                    }

                    Destination.RECORDER -> {
                        Recorder(onBack = { destination = Destination.HOME })
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        accessGranted = NotificationAccess.isGranted(this)
        notificationsAllowed = NotificationAccess.canPostNotifications(this)
        if (!accessGranted) AppLog.w("notification access is off")
    }

    @Composable
    private fun Guide(onDone: () -> Unit) {
        NotificationAccessGuide(
            state = GuideState(Build.VERSION.SDK_INT, accessGranted, notificationsAllowed),
            onOpenAppInfo = { NotificationAccess.openAppInfo(this) },
            onOpenNotificationAccess = { NotificationAccess.openSettings(this) },
            onAllowNotifications = {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    askToPostNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            },
            onDone = onDone,
        )
    }

    @Composable
    private fun Recorder(onBack: () -> Unit) {
        val store = (application as DuitLogApplication).recordings
        val recordings by store.recordings.collectAsState()
        val walletApps = remember { walletAppsOnPhone(packageManager) }
        RecorderScreen(
            walletApps = walletApps,
            recordings = recordings,
            zone = ZoneId.systemDefault(),
            onShare = ::shareRecordings,
            onClear = ::clearRecordings,
            onBack = onBack,
        )
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
        share(copy, R.string.share_log_chooser)
    }

    private fun shareRecordings() {
        val store = (application as DuitLogApplication).recordings
        try {
            store.exportTo(recordingsCopy(), ZoneId.systemDefault())
        } catch (e: IOException) {
            AppLog.e("writing the recordings for sharing failed", e)
            return
        }
        AppLog.i("sharing ${store.recordings.value.size} recordings")
        share(recordingsCopy(), R.string.recorder_share_chooser)
    }

    private fun clearRecordings() {
        val store = (application as DuitLogApplication).recordings
        val count = store.recordings.value.size
        try {
            store.clear()
        } catch (e: IllegalStateException) {
            AppLog.e("clearing the recordings failed", e)
            return
        }
        // The shared copy holds the same notification text, so it goes too.
        recordingsCopy().delete()
        AppLog.i("cleared $count recordings")
    }

    private fun recordingsCopy() = File(File(cacheDir, SHARED_DIR), "duit-log-recordings.txt")

    private fun share(
        file: File,
        chooserTitle: Int,
    ) {
        val uri = FileProvider.getUriForFile(this, "$packageName.files", file)
        val send =
            Intent(Intent.ACTION_SEND)
                .setType("text/plain")
                .putExtra(Intent.EXTRA_STREAM, uri)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        startActivity(Intent.createChooser(send, getString(chooserTitle)))
    }

    private companion object {
        // Must match res/xml/shared_files.xml.
        const val SHARED_DIR = "shared"
    }
}
