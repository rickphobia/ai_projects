package com.rickphobia.duitlog.core.ledger

/** A bucket in the Expense or the Income list. */
data class Category(
    val id: Long,
    val kind: Kind,
    val name: String,
)
