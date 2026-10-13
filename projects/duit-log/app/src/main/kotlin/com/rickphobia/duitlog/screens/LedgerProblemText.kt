package com.rickphobia.duitlog.screens

import androidx.annotation.StringRes
import com.rickphobia.duitlog.R
import com.rickphobia.duitlog.core.ledger.LedgerException

/** The message a screen shows for each of the Ledger's refusals. */
@StringRes
internal fun problemText(problem: LedgerException): Int =
    when (problem) {
        is LedgerException.AmountUnreadable, is LedgerException.AmountNotPositive -> R.string.problem_amount
        is LedgerException.MerchantMissing -> R.string.problem_merchant
        is LedgerException.UnknownCategory, is LedgerException.CategoryKindMismatch -> R.string.problem_category
        is LedgerException.UnknownTransaction -> R.string.problem_gone
        is LedgerException.UnknownCouldntRead -> R.string.problem_entry_gone
        is LedgerException.CategoryNameMissing -> R.string.problem_category_name
        is LedgerException.CategoryNameTaken -> R.string.problem_category_taken
        is LedgerException.OtherIsFixed -> R.string.problem_other_fixed
        is LedgerException.BadMoveTarget -> R.string.problem_move_target
    }
