package com.rickphobia.duitlog.core.ledger

import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import com.rickphobia.duitlog.core.storage.DuitLogDatabase
import java.time.Clock
import java.time.LocalDateTime
import java.time.ZoneId

val KUALA_LUMPUR: ZoneId = ZoneId.of("Asia/Kuala_Lumpur")

/** A Ledger on a fresh in-memory database, with the clock stopped at [now] in [zone]. */
fun newLedger(
    now: LocalDateTime = LocalDateTime.of(2026, 10, 12, 9, 0),
    zone: ZoneId = KUALA_LUMPUR,
): Ledger {
    val driver = JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY)
    DuitLogDatabase.Schema.create(driver)
    return Ledger(DuitLogDatabase(driver), Clock.fixed(now.atZone(zone).toInstant(), zone))
}

fun Ledger.categoryId(
    kind: Kind,
    name: String,
): Long = categories(kind).first { it.name == name }.id

/** Adds a Transaction by hand, filling in whatever the test doesn't care about. */
fun Ledger.add(
    kind: Kind,
    amountSen: Long,
    at: LocalDateTime,
    merchant: String = "Kedai Ali",
    category: String = "Other",
): Transaction =
    addByHand(
        HandEntry(
            kind = kind,
            amountSen = amountSen,
            occurredAt = at,
            merchant = merchant,
            categoryId = categoryId(kind, category),
            note = null,
        ),
    )
