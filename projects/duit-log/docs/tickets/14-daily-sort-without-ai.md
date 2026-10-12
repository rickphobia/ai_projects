# 14: Daily Sort without AI

**What to build:** Once a day at 8pm (changeable in Settings), the Daily Sort gives a Category to every Transaction that still has none: Merchant Rules first, then Other for whatever is left. A quiet daily summary notification follows ("RM87.40 over 6 Transactions today, tap to check"), which can be turned off.

**Blocked by:** 13 (Refunds)

**Status:** ready

**Touches:** core/sorting, app/scheduling, app/settings

**Effort:** medium

- [ ] Daily Sort in `core`, given an optional Category Sorter port; with none, leftovers go to Other; tests cover rules applied first and leftovers
- [ ] WorkManager runs it daily at the chosen time; changing the time reschedules it; a few minutes late is fine
- [ ] Settings: Daily Sort time and daily summary on/off
- [ ] Daily summary notification on a low-importance channel, only if there were Transactions that day
- [ ] The log records each run: when, how many sorted by rule, how many left
- [ ] On-phone check: set the time two minutes ahead and see unsorted Transactions sorted and the summary posted
