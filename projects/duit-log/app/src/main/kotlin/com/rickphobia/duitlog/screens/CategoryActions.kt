package com.rickphobia.duitlog.screens

import com.rickphobia.duitlog.core.ledger.Kind
import com.rickphobia.duitlog.core.ledger.LedgerException

/** The Ledger calls behind the Categories screen. Each throws a [LedgerException] when the Ledger refuses. */
class CategoryActions(
    val add: suspend (Kind, String) -> Unit,
    val rename: suspend (id: Long, name: String) -> Unit,
    val transactionCount: suspend (id: Long) -> Long,
    val delete: suspend (id: Long, moveTo: Long) -> Unit,
)
