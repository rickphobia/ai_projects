package com.rickphobia.duitlog.core.ledger

/** Which way a Transaction's money went. Stored by name, so renaming a value needs a migration. */
enum class Kind {
    EXPENSE,
    INCOME,
}
