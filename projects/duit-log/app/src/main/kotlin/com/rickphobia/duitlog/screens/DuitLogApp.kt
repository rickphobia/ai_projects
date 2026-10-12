package com.rickphobia.duitlog.screens

import android.database.SQLException
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.rickphobia.duitlog.core.ledger.Category
import com.rickphobia.duitlog.core.ledger.HandEntry
import com.rickphobia.duitlog.core.ledger.Kind
import com.rickphobia.duitlog.core.ledger.Ledger
import com.rickphobia.duitlog.core.ledger.LedgerException
import com.rickphobia.duitlog.core.ledger.Transaction
import com.rickphobia.duitlog.logging.AppLog
import com.rickphobia.duitlog.onboarding.AccessMissingBanner
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.YearMonth
import java.time.ZoneId

/**
 * Which screen is showing, and the Ledger calls behind them. Every Ledger call runs off the main
 * thread, because each one is a database query.
 */
@Composable
fun DuitLogApp(
    ledger: Ledger,
    versionName: String,
    buildNumber: Int,
    access: AccessBanner,
    onOpenRecorder: () -> Unit,
    onOpenGuide: () -> Unit,
    onShareLog: () -> Unit,
) {
    var month by rememberSaveable { mutableStateOf(ledger.currentMonth()) }
    var adding by rememberSaveable { mutableStateOf(false) }
    // The id of the Transaction whose details are open, if any.
    var openId by rememberSaveable { mutableStateOf<Long?>(null) }
    // Bumped after a save, so the Month is read again.
    var saves by remember { mutableIntStateOf(0) }

    val monthState by produceMonth(ledger, month, saves)

    val editing = openId
    if (editing != null) {
        BackHandler { openId = null }
        OpenTransaction(
            ledger = ledger,
            id = editing,
            zone = (monthState as? MonthState.Shown)?.summary?.zone ?: ZoneId.systemDefault(),
            onClose = { openId = null },
            onChanged = { landedIn ->
                landedIn?.let { month = it }
                saves++
                openId = null
            },
        )
    } else if (adding) {
        BackHandler { adding = false }
        val categories by produceCategories(ledger)
        AddTransactionScreen(
            categories = categories,
            now = ledger.now(),
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
            state = monthState,
            onMonthChange = { month = it },
            onAdd = { adding = true },
            onOpen = { openId = it.id },
            menu = { AppMenu(versionName, buildNumber, onOpenRecorder, onOpenGuide, onShareLog) },
            banner = {
                if (!access.granted) {
                    Box(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                        AccessMissingBanner(onFix = access.onFix)
                    }
                }
            },
        )
    }
}

/**
 * The details of Transaction [id]. [onChanged] gets the Month an edit landed in, or null after a
 * delete; [onClose] runs when the user backs out or the Transaction is gone.
 */
@Composable
private fun OpenTransaction(
    ledger: Ledger,
    id: Long,
    zone: ZoneId,
    onClose: () -> Unit,
    onChanged: (YearMonth?) -> Unit,
) {
    val categories by produceCategories(ledger)
    val opened by produceState<Transaction?>(null, id) {
        value = withContext(Dispatchers.IO) { openTransaction(ledger, id) }
        if (value == null) onClose()
    }
    opened?.let { transaction ->
        EditTransactionScreen(
            transaction = transaction,
            zone = zone,
            categories = categories,
            onSave = { entry, excluded -> edit(ledger, id, entry, excluded) },
            onSaved = { occurredAt -> onChanged(YearMonth.from(occurredAt)) },
            onDelete = { delete(ledger, id) },
            onDeleted = { onChanged(null) },
            onCancel = onClose,
        )
    }
}

/** [month] read off the main thread; [saves] changing reads it again. */
@Composable
private fun produceMonth(
    ledger: Ledger,
    month: YearMonth,
    saves: Int,
) = produceState<MonthState>(MonthState.Loading, month, saves) {
    value = MonthState.Loading
    value =
        try {
            MonthState.Shown(withContext(Dispatchers.IO) { ledger.monthSummary(month) })
        } catch (e: SQLException) {
            AppLog.e("reading the Month from the database failed", e)
            MonthState.Unreadable
        }
}

@Composable
private fun produceCategories(ledger: Ledger) =
    produceState(emptyMap<Kind, List<Category>>()) {
        value = withContext(Dispatchers.IO) { Kind.entries.associateWith(ledger::categories) }
    }

/** Whether notification access is on, and how to fix it when it isn't. */
data class AccessBanner(
    val granted: Boolean,
    val onFix: () -> Unit,
)

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

/** The Transaction to open, or null when it is gone or unreadable; either way the log says so. */
private fun openTransaction(
    ledger: Ledger,
    id: Long,
): Transaction? =
    try {
        ledger.transaction(id)
    } catch (e: LedgerException.UnknownTransaction) {
        AppLog.w("Transaction $id to open no longer exists", e)
        null
    } catch (e: SQLException) {
        AppLog.e("reading Transaction $id failed", e)
        null
    }

/** Saves the edited fields, then the Excluded flag if it changed; logs ids only. */
private suspend fun edit(
    ledger: Ledger,
    id: Long,
    entry: HandEntry,
    excluded: Boolean,
) {
    try {
        withContext(Dispatchers.IO) {
            ledger.edit(id, entry)
            ledger.setExcluded(id, excluded)
        }
    } catch (e: LedgerException) {
        AppLog.i("edit of Transaction $id refused: ${e.javaClass.simpleName}")
        throw e
    }
    AppLog.i("edited Transaction $id, excluded=$excluded")
}

private suspend fun delete(
    ledger: Ledger,
    id: Long,
) {
    withContext(Dispatchers.IO) { ledger.delete(id) }
    AppLog.i("deleted Transaction $id")
}
