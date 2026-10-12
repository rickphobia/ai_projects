package com.rickphobia.duitlog.core.ledger

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import java.time.LocalDateTime
import java.time.YearMonth

class CategoryListsTest {
    private val lunchTime = LocalDateTime.of(2026, 10, 12, 12, 30)
    private val october = YearMonth.of(2026, 10)

    @Test
    fun `an added Category goes at the end of its list only`() {
        val ledger = newLedger()

        val added = ledger.categoryLists.add(Kind.EXPENSE, "  Pets ")

        assertEquals(Category(added.id, Kind.EXPENSE, "Pets"), added)
        assertEquals(added, ledger.categories(Kind.EXPENSE).last())
        assertEquals(
            listOf("Salary", "Allowance", "Transfers", "Other"),
            ledger.categories(Kind.INCOME).map { it.name },
        )
    }

    @Test
    fun `a name the list already has is refused, ignoring case, but the other list may have it`() {
        val ledger = newLedger()

        assertThrows(LedgerException.CategoryNameTaken::class.java) { ledger.categoryLists.add(Kind.EXPENSE, "f&b") }
        assertThrows(LedgerException.CategoryNameTaken::class.java) {
            ledger.categoryLists.rename(ledger.categoryId(Kind.EXPENSE, "Tech"), "Health")
        }
        assertThrows(LedgerException.CategoryNameMissing::class.java) { ledger.categoryLists.add(Kind.EXPENSE, " ") }
        assertEquals("F&B", ledger.categoryLists.add(Kind.INCOME, "F&B").name)
    }

    @Test
    fun `a rename shows on the Category's Transactions`() {
        val ledger = newLedger()
        val lunch = ledger.add(Kind.EXPENSE, 1_250, lunchTime, category = "F&B")

        ledger.categoryLists.rename(lunch.categoryId!!, "Food")

        assertEquals("Food", ledger.transaction(lunch.id).categoryName)
    }

    @Test
    fun `a Category can change the case of its own name`() {
        val ledger = newLedger()

        assertEquals("FnB", ledger.categoryLists.rename(ledger.categoryId(Kind.EXPENSE, "F&B"), "FnB").name)
        assertEquals("fnb", ledger.categoryLists.rename(ledger.categoryId(Kind.EXPENSE, "FnB"), " fnb ").name)
    }

    @Test
    fun `deleting a Category moves its Transactions and the Month's per-Category totals follow`() {
        val ledger = newLedger()
        ledger.add(Kind.EXPENSE, 1_250, lunchTime, category = "F&B")
        ledger.add(Kind.EXPENSE, 750, lunchTime, category = "F&B")
        ledger.add(Kind.EXPENSE, 3_000, lunchTime, category = "Groceries")
        val fnb = ledger.categoryId(Kind.EXPENSE, "F&B")
        assertEquals(2L, ledger.categoryLists.transactionCount(fnb))

        ledger.categoryLists.delete(fnb, moveTo = ledger.categoryId(Kind.EXPENSE, "Groceries"))

        assertEquals(mapOf("Groceries" to 5_000L), expensesByCategory(ledger))
        assertEquals(null, ledger.categories(Kind.EXPENSE).find { it.id == fnb })
        assertEquals(0L, ledger.categoryLists.transactionCount(fnb))
    }

    @Test
    fun `Other refuses delete and rename`() {
        val ledger = newLedger()
        val other = ledger.categoryId(Kind.EXPENSE, OTHER)
        val tech = ledger.categoryId(Kind.EXPENSE, "Tech")

        assertThrows(LedgerException.OtherIsFixed::class.java) { ledger.categoryLists.rename(other, "Misc") }
        assertThrows(LedgerException.OtherIsFixed::class.java) { ledger.categoryLists.delete(other, moveTo = tech) }
        assertThrows(LedgerException.CategoryNameTaken::class.java) { ledger.categoryLists.rename(tech, "other") }
        assertEquals(OTHER, ledger.categories(Kind.EXPENSE).last().name)
    }

    @Test
    fun `a delete moving to itself, the other list or nowhere is refused and changes nothing`() {
        val ledger = newLedger()
        val lunch = ledger.add(Kind.EXPENSE, 1_250, lunchTime, category = "F&B")
        val fnb = lunch.categoryId!!

        assertThrows(LedgerException.BadMoveTarget::class.java) { ledger.categoryLists.delete(fnb, moveTo = fnb) }
        assertThrows(LedgerException.BadMoveTarget::class.java) {
            ledger.categoryLists.delete(fnb, moveTo = ledger.categoryId(Kind.INCOME, OTHER))
        }
        assertThrows(LedgerException.BadMoveTarget::class.java) { ledger.categoryLists.delete(fnb, moveTo = 9_999) }
        assertThrows(LedgerException.UnknownCategory::class.java) { ledger.categoryLists.rename(9_999, "X") }
        assertEquals(lunch, ledger.transaction(lunch.id))
    }

    private fun expensesByCategory(ledger: Ledger): Map<String?, Long> =
        ledger
            .monthSummary(october)
            .days
            .flatMap { it.transactions }
            .groupBy { it.categoryName }
            .mapValues { (_, transactions) -> transactions.sumOf { it.amountSen } }
}
