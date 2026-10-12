package com.rickphobia.duitlog.screens

import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import com.rickphobia.duitlog.core.ledger.HandEntry
import com.rickphobia.duitlog.core.ledger.Kind
import com.rickphobia.duitlog.core.ledger.Ledger
import com.rickphobia.duitlog.core.ledger.LedgerException
import com.rickphobia.duitlog.core.summary.MonthSummary
import com.rickphobia.duitlog.logging.AppLog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.YearMonth

/**
 * Which screen is showing, and the Ledger calls behind them. Every Ledger call runs off the main
 * thread, because each one is a database query.
 */
@Composable
fun DuitLogApp(
    ledger: Ledger,
    versionName: String,
    buildNumber: Int,
    onShareLog: () -> Unit,
) {
    var month by rememberSaveable { mutableStateOf(ledger.currentMonth()) }
    var adding by rememberSaveable { mutableStateOf(false) }
    // Bumped after a save, so the Month is read again.
    var saves by remember { mutableIntStateOf(0) }

    val summary by produceState<MonthSummary?>(null, month, saves) {
        value = withContext(Dispatchers.IO) { ledger.monthSummary(month) }
    }

    if (adding) {
        BackHandler { adding = false }
        val categories by produceState(emptyMap()) {
            value = withContext(Dispatchers.IO) { Kind.entries.associateWith(ledger::categories) }
        }
        AddTransactionScreen(
            categories = categories,
            onSave = { entry -> addByHand(ledger, entry) },
            onSaved = { occurredAt ->
                // Show the Month the new Transaction landed in.
                month = YearMonth.from(occurredAt)
                saves++
                adding = false
            },
            onCancel = { adding = false },
        )
    } else {
        DailyScreen(
            month = month,
            summary = summary?.takeIf { it.month == month },
            onMonthChange = { month = it },
            onAdd = { adding = true },
            menu = { AppMenu(versionName, buildNumber, onShareLog) },
        )
    }
}

/** Adds [entry] off the main thread and logs the outcome: kind and id only, never the Merchant or Note. */
private suspend fun addByHand(
    ledger: Ledger,
    entry: HandEntry,
) {
    val added =
        try {
            withContext(Dispatchers.IO) { ledger.addByHand(entry) }
        } catch (e: LedgerException) {
            AppLog.i("add by hand refused: ${e.javaClass.simpleName}")
            throw e
        }
    AppLog.i("added ${added.kind} ${added.id} by hand")
}
