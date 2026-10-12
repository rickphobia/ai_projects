package com.rickphobia.duitlog.core.reader

/** An e-wallet whose notifications the app reads. [label] is how the app names it on screen. */
enum class Wallet(
    val label: String,
) {
    TNG("Touch 'n Go eWallet"),
    GRAB("Grab"),
    SHOPEE("Shopee"),
}

/**
 * Which app posts each Wallet's notifications, by Android package name. A notification is
 * matched on its exact package name, never on a prefix or on its text.
 */
class WalletApps(
    val packages: Map<String, Wallet>,
) {
    fun walletFor(packageName: String): Wallet? = packages[packageName]

    companion object {
        /**
         * The Malaysian Wallet apps. The README ("Wallet apps") says how they were confirmed; the
         * app's manifest lists the same names under <queries> so the recorder can see them.
         */
        val DEFAULT =
            WalletApps(
                mapOf(
                    "my.com.tngdigital.ewallet" to Wallet.TNG,
                    "com.grabtaxi.passenger" to Wallet.GRAB,
                    "com.shopee.my" to Wallet.SHOPEE,
                ),
            )
    }
}
