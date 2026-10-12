package com.rickphobia.duitlog.capture

import android.app.Notification
import android.content.ComponentName
import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.rickphobia.duitlog.DuitLogApplication
import com.rickphobia.duitlog.core.reader.NotificationContent
import com.rickphobia.duitlog.core.reader.NotificationReader
import com.rickphobia.duitlog.core.reader.Reading
import com.rickphobia.duitlog.core.reader.WalletApps
import com.rickphobia.duitlog.logging.AppLog
import java.io.IOException
import java.time.Instant
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Receives every notification on the phone once the user grants notification access. Android
 * offers nothing narrower, so the first thing done with each one is the Notification Reader's
 * "Not a Wallet" check on the posting app, and those are dropped without their text being read,
 * stored, logged or counted (decision 0003). Wallet notifications go to the recorder
 * (milestone 1).
 */
class WalletNotificationListener : NotificationListenerService() {
    private val reader = NotificationReader(WalletApps.DEFAULT)

    // Android calls the listener on the main thread; file writes happen off it, in arrival order.
    private lateinit var writer: ExecutorService

    override fun onCreate() {
        super.onCreate()
        writer = Executors.newSingleThreadExecutor()
    }

    override fun onDestroy() {
        writer.shutdown()
        super.onDestroy()
    }

    override fun onListenerConnected() {
        connected = true
        AppLog.i("notification listener started")
    }

    override fun onListenerDisconnected() {
        connected = false
        AppLog.i("notification listener stopped")
    }

    override fun onNotificationPosted(posted: StatusBarNotification) {
        when (val reading = reader.read(posted.packageName) { posted.content() }) {
            Reading.NotAWallet -> {
                return
            }

            is Reading.FromWallet -> {
                val recording =
                    with(reading.content) {
                        Recording(reading.wallet, posted.packageName, posted.key, postedAt, title, text, expandedText)
                    }
                writer.execute { record(recording) }
            }
        }
    }

    private fun record(recording: Recording) {
        val store = (application as DuitLogApplication).recordings
        val described = "${recording.wallet.name} notification posted at ${recording.postedAt}"
        try {
            when (store.record(recording)) {
                RecordOutcome.RECORDED -> {
                    AppLog.i("recorded a $described")
                }

                RecordOutcome.REPEAT -> {
                    AppLog.d("not recording a $described: same words as before")
                }

                RecordOutcome.FULL -> {
                    AppLog.w(
                        "not recording a $described: the recordings are full, share and clear them",
                    )
                }
            }
        } catch (e: IOException) {
            AppLog.e("recording a $described failed", e)
        }
    }

    private fun StatusBarNotification.content(): NotificationContent {
        val extras = notification.extras
        // Wallets put the long form of a message in big text or, for inbox-style notifications,
        // in text lines.
        val expanded =
            extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
                ?: extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.joinToString("\n")
        return NotificationContent(
            title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty(),
            text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty(),
            expandedText = expanded?.toString().orEmpty(),
            postedAt = Instant.ofEpochMilli(postTime),
        )
    }

    companion object {
        /** Whether Android has the listener connected in this process right now. */
        @Volatile
        var connected = false
            private set

        /**
         * Asks Android to connect the listener again. Access can be granted while the listener is
         * stopped, e.g. after an app update or a battery optimiser killed it.
         */
        fun rebind(context: Context) {
            AppLog.w("notification access is on but the listener isn't connected; asking Android to rebind it")
            requestRebind(ComponentName(context, WalletNotificationListener::class.java))
        }
    }
}
