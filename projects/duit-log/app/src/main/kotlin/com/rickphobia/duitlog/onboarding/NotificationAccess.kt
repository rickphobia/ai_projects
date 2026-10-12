package com.rickphobia.duitlog.onboarding

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.rickphobia.duitlog.capture.WalletNotificationListener
import com.rickphobia.duitlog.logging.AppLog

/** What the app has been allowed, and the settings pages that change it. */
object NotificationAccess {
    /** Whether the user has switched on duit-log in Android's notification access settings. */
    fun isGranted(context: Context): Boolean =
        NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)

    /** Whether duit-log may post its own notifications (always, before Android 13). */
    fun canPostNotifications(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED

    /** Opens duit-log's own notification access page, or the list of apps where it has none. */
    fun openSettings(context: Context) {
        // The per-app page exists from Android 11, and even then some phones' settings apps lack it.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val listener = ComponentName(context, WalletNotificationListener::class.java)
            val ownPage =
                Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
                    .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, listener.flattenToString())
            if (start(context, ownPage)) return
        }
        start(context, Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
    }

    /** Opens App info, where Android 13 and later hide "Allow restricted settings". */
    fun openAppInfo(context: Context) {
        start(
            context,
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null)),
        )
    }

    private fun start(
        context: Context,
        intent: Intent,
    ): Boolean =
        try {
            context.startActivity(intent)
            true
        } catch (e: ActivityNotFoundException) {
            AppLog.w("no settings page for ${intent.action}", e)
            false
        }
}
