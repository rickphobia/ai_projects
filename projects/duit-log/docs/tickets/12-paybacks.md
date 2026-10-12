# 12: Paybacks

**What to build:** A Transfer you receive within 2 hours of an Expense larger than it becomes a Payback for the most recent such Expense, reducing it instead of counting as Income. Several Paybacks add up, capped at the Expense's amount, with any extra counted as Income. The prompt says "RM30 from Ali. Payback for Nasi Kandar Pelita (RM120)?" with [Payback] [Income]; ignoring it keeps the Payback. The Expense shows "RM120 − RM90 paid back". In the details you can turn a Payback into Income or link any received Transfer to an Expense by hand.

**Blocked by:** 11 (Transfers and Income)

**Status:** ready

**Touches:** core/ledger, core/summary, app/prompt, app/screens

**Effort:** medium

- [ ] Payback rule in the Ledger: unexcluded Expenses posted in the 2 hours before, larger than the Transfer and not fully paid back, most recent first
- [ ] Tests: inside and outside 2 hours; lunch then a Grab ride, the lunch chosen; three Paybacks adding up; the cap with the extra as Income; turning a Payback into Income; a late Transfer linked by hand; the cap re-applied when the Expense amount is edited; an Excluded Expense never matched
- [ ] Month summary and per-Category totals count the Expense minus its Paybacks
- [ ] Prompt variant with [Payback] [Income]
- [ ] The list and details show the Expense's Paybacks; details offer "Turn into Income" and "Payback for…"
- [ ] On-phone check: pay a meal with TNG, have a friend transfer part of it back, see the Expense reduced
