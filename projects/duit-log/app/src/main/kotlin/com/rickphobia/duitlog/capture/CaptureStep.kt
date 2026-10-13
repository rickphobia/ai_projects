package com.rickphobia.duitlog.capture

import android.database.SQLException
import com.rickphobia.duitlog.core.ledger.CaptureOutcome
import com.rickphobia.duitlog.core.ledger.KeepOutcome
import com.rickphobia.duitlog.core.ledger.Ledger
import com.rickphobia.duitlog.core.reader.Reading
import com.rickphobia.duitlog.logging.AppLog

/**
 * Saves one Wallet notification's [reading] in [ledger] and logs the outcome with the Wallet and
 * posting time only: never the text or the Merchant. Returns whether the Ledger changed, so the
 * screens know to read it again.
 */
fun capture(
    ledger: Ledger,
    reading: Reading.FromWallet,
): Boolean {
    val described = "${reading.wallet.name} notification posted at ${reading.content.postedAt}"
    return try {
        when (reading) {
            is Reading.Read -> {
                capturePayment(ledger, reading, described)
            }

            is Reading.Unreadable -> {
                keepUnreadable(ledger, reading, described)
            }

            is Reading.Ignored -> {
                AppLog.i("ignored a $described: ${reading.reason}")
                false
            }
        }
    } catch (e: SQLException) {
        AppLog.e("saving a $described failed", e)
        false
    }
}

private fun capturePayment(
    ledger: Ledger,
    read: Reading.Read,
    described: String,
): Boolean =
    when (val outcome = ledger.captures.payment(read)) {
        is CaptureOutcome.Captured -> {
            AppLog.i("captured a $described as ${outcome.transaction.kind} ${outcome.transaction.id}")
            true
        }

        is CaptureOutcome.Duplicate -> {
            AppLog.i("a $described is a duplicate of Transaction ${outcome.existingId}")
            false
        }
    }

private fun keepUnreadable(
    ledger: Ledger,
    unreadable: Reading.Unreadable,
    described: String,
): Boolean =
    when (val outcome = ledger.captures.keepUnreadable(unreadable)) {
        // A warning: the Wallet may have changed its wording, and the fix is a new sample.
        is KeepOutcome.Kept -> {
            AppLog.w("couldn't read a $described; kept as \"Couldn't read\" entry ${outcome.entry.id}")
            true
        }

        is KeepOutcome.Duplicate -> {
            AppLog.i("a $described is a duplicate of \"Couldn't read\" entry ${outcome.existingId}")
            false
        }
    }
