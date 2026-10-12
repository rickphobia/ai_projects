package com.rickphobia.duitlog.core.ledger

/**
 * Turns whole sen into "RM1,234.50" and typed text back into sen. Only integer arithmetic is used,
 * so no amount ever picks up a floating-point rounding error.
 */
object Ringgit {
    private const val SEN_PER_RINGGIT = 100L
    private const val DIGITS_PER_GROUP = 3

    // Up to 10 digits of ringgit (plain, or grouped with commas) and up to two decimals.
    private val typedAmount = Regex("""^(\d{1,10}|\d{1,3}(?:,\d{3}){1,3})?(?:\.(\d{0,2}))?$""")

    fun format(sen: Long): String {
        val sign = if (sen < 0) "-" else ""
        val absolute = Math.abs(sen)
        val ringgit =
            (absolute / SEN_PER_RINGGIT)
                .toString()
                .reversed()
                .chunked(DIGITS_PER_GROUP)
                .joinToString(",")
                .reversed()
        val cents = (absolute % SEN_PER_RINGGIT).toString().padStart(2, '0')
        return "${sign}RM$ringgit.$cents"
    }

    /** Reads "12", "12.3", "1,234.50" or ".5" as whole sen. Throws [LedgerException.AmountUnreadable]. */
    fun parse(typed: String): Long {
        val match = typedAmount.matchEntire(typed.trim()) ?: throw LedgerException.AmountUnreadable()
        val ringgit = match.groupValues[1].replace(",", "")
        val decimals = match.groupValues[2]
        if (ringgit.isEmpty() && decimals.isEmpty()) throw LedgerException.AmountUnreadable()
        val wholeRinggit = if (ringgit.isEmpty()) 0L else ringgit.toLong()
        return wholeRinggit * SEN_PER_RINGGIT + decimals.padEnd(2, '0').toLong()
    }
}
