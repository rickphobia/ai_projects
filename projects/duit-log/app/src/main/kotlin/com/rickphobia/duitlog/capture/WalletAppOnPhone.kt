package com.rickphobia.duitlog.capture

import android.content.pm.PackageManager
import android.os.Build
import com.rickphobia.duitlog.core.reader.Wallet
import com.rickphobia.duitlog.core.reader.WalletApps

/** A Wallet app the recorder accepts, and whether it is installed on this phone. */
data class WalletAppOnPhone(
    val wallet: Wallet,
    val packageName: String,
    val installed: Boolean,
)

/**
 * Checks which of the accepted Wallet apps are installed, so the owner can confirm the package
 * names on a real phone. Android 11 and later only answer for packages the manifest names under
 * <queries>.
 */
fun walletAppsOnPhone(
    packageManager: PackageManager,
    walletApps: WalletApps = WalletApps.DEFAULT,
): List<WalletAppOnPhone> =
    walletApps.packages.map { (packageName, wallet) ->
        WalletAppOnPhone(wallet, packageName, packageManager.isInstalled(packageName))
    }

private fun PackageManager.isInstalled(packageName: String): Boolean =
    try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(0))
        } else {
            @Suppress("DEPRECATION")
            getPackageInfo(packageName, 0)
        }
        true
    } catch (_: PackageManager.NameNotFoundException) {
        false
    }
