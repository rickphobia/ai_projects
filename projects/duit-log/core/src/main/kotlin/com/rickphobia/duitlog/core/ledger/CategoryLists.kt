package com.rickphobia.duitlog.core.ledger

import com.rickphobia.duitlog.core.storage.DuitLogDatabase

/** The Category in each list that can't be renamed or deleted. Found by name, which can't change. */
const val OTHER = "Other"

/** Adding, renaming and deleting Categories, with the checks that keep each list usable. */
class CategoryLists internal constructor(
    private val database: DuitLogDatabase,
) {
    /** Adds [name] at the end of the [kind] list; refuses a blank name or one the list already has. */
    fun add(
        kind: Kind,
        name: String,
    ): Category {
        val checked = checkName(kind, name, renaming = null)
        val id =
            database.transactionWithResult {
                database.categoryQueries.insert(kind.name, checked)
                database.categoryQueries.lastInsertedId().executeAsOne()
            }
        return category(id)
    }

    /** Refuses Other, a blank name, and a name the list already has. */
    fun rename(
        id: Long,
        name: String,
    ): Category {
        val category = changeable(id)
        val checked = checkName(category.kind, name, renaming = category)
        database.categoryQueries.rename(checked, id)
        return category(id)
    }

    /** How many Transactions Category [id] has, to know whether deleting it needs a move target. */
    fun transactionCount(id: Long): Long = database.ledgerTransactionQueries.countInCategory(id).executeAsOne()

    /** Moves Category [id]'s Transactions to [moveTo], another Category in the same list, then deletes it. */
    fun delete(
        id: Long,
        moveTo: Long,
    ) {
        val category = changeable(id)
        val target = database.categoryQueries.byId(moveTo, ::toCategory).executeAsOneOrNull()
        if (target == null || target.id == id || target.kind != category.kind) {
            throw LedgerException.BadMoveTarget(moveTo)
        }
        database.transaction {
            database.ledgerTransactionQueries.moveCategory(to = moveTo, from = id)
            database.categoryQueries.delete(id)
        }
    }

    private fun category(id: Long): Category =
        database.categoryQueries.byId(id, ::toCategory).executeAsOneOrNull()
            ?: throw LedgerException.UnknownCategory(id)

    /** Category [id], unless it is Other. */
    private fun changeable(id: Long): Category {
        val category = category(id)
        if (category.name == OTHER) throw LedgerException.OtherIsFixed()
        return category
    }

    /** [name] trimmed, or a refusal when it is blank or already in the [kind] list (other than [renaming]). */
    private fun checkName(
        kind: Kind,
        name: String,
        renaming: Category?,
    ): String {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) throw LedgerException.CategoryNameMissing()
        val taken =
            database.categoryQueries
                .ofKind(kind.name, ::toCategory)
                .executeAsList()
                .any { it.id != renaming?.id && it.name.equals(trimmed, ignoreCase = true) }
        if (taken) throw LedgerException.CategoryNameTaken(kind)
        return trimmed
    }
}
