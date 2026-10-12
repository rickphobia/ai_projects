package com.rickphobia.duitlog.screens

import android.database.SQLException
import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import com.rickphobia.duitlog.core.ledger.CouldntRead
import com.rickphobia.duitlog.core.ledger.Ledger
import com.rickphobia.duitlog.core.ledger.LedgerException
import com.rickphobia.duitlog.logging.AppLog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDateTime
import java.time.YearMonth
import java.time.ZoneId
import java.time.temporal.ChronoUnit

/**
 * The "Couldn't read" list and the + screen it opens. An entry added by hand leaves the list, and
 * [onAdded] gets the Month the new Transaction landed in. [changes] changing reads the list again,
 * for entries the listener adds while it is open.
 */
@Composable
fun CouldntReadShown(
    ledger: Ledger,
    changes: Int,
    onAdded: (YearMonth) -> Unit,
    onBack: () -> Unit,
) {
    // The id of the entry being added by hand, if any.
    var addingId by rememberSaveable { mutableStateOf<Long?>(null) }
    var removals by remember { mutableIntStateOf(0) }
    val entries by produceState(emptyList<CouldntRead>(), changes, removals) {
        value = readEntries(ledger)
    }
    val scope = rememberCoroutineScope()
    val zone = ZoneId.systemDefault()

    val adding = addingId?.let { id -> entries.firstOrNull { it.id == id } }
    if (adding != null) {
        BackHandler { addingId = null }
        val categories by produceCategories(ledger)
        AddTransactionScreen(
            categories = categories,
            now = LocalDateTime.ofInstant(adding.postedAt, zone).truncatedTo(ChronoUnit.MINUTES),
            onSave = { entry -> addByHand(ledger, entry) },
            onSaved = { occurredAt ->
                scope.launch { remove(ledger, adding.id, "added by hand") }
                addingId = null
                onAdded(YearMonth.from(occurredAt))
            },
            onCancel = { addingId = null },
        )
    } else {
        BackHandler(onBack = onBack)
        CouldntReadScreen(
            entries = entries,
            zone = zone,
            onAddByHand = { addingId = it.id },
            onDismiss = { entry ->
                scope.launch {
                    remove(ledger, entry.id, "dismissed")
                    removals++
                }
            },
            onBack = onBack,
        )
    }
}

private suspend fun readEntries(ledger: Ledger): List<CouldntRead> =
    try {
        withContext(Dispatchers.IO) { ledger.captures.couldntRead() }
    } catch (e: SQLException) {
        AppLog.e("reading the \"Couldn't read\" list failed", e)
        emptyList()
    }

/** Removes entry [id] off the main thread; logs [why] with the id only, never the text. */
private suspend fun remove(
    ledger: Ledger,
    id: Long,
    why: String,
) {
    try {
        withContext(Dispatchers.IO) { ledger.captures.removeCouldntRead(id) }
        AppLog.i("\"Couldn't read\" entry $id $why")
    } catch (e: LedgerException.UnknownCouldntRead) {
        AppLog.w("\"Couldn't read\" entry $id to remove no longer exists", e)
    } catch (e: SQLException) {
        AppLog.e("removing \"Couldn't read\" entry $id failed", e)
    }
}
