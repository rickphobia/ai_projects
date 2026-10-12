# 03: Daily tab with hand-added Transactions

**What to build:** The home screen becomes the Daily tab: the Month's Income, Expenses and Total at the top, Transactions grouped by day (newest first) with each day's subtotal, and arrows or a swipe to move between Months. A + button adds an Expense or Income by hand with amount, date and time, Merchant, Category (from the default lists) and Note. This is the Ledger's first slice: the seam every later ticket tests through.

**Blocked by:** 01 (Walking skeleton)

**Status:** ready

**Touches:** core/ledger, core/summary, app/screens

**Effort:** medium

- [ ] Ledger in `core` with storage on SQLite; tests run on a real in-memory database with a fake clock
- [ ] Amounts held as whole sen, never floating point; shown as RM with two decimals
- [ ] Default Expense Categories (Transport, F&B, Groceries, Shopping, Bills, Entertainment, Education, Tech, Health, Transfers, Other) and Income Categories (Salary, Allowance, Transfers, Other) created on first run
- [ ] Add by hand: Expense or Income with every field; the Category list matches the kind
- [ ] Month summary: Income, Expenses, Total, day groups with subtotals; Months follow the phone's time zone; tests cover a Transaction at 23:59 on the last day of a Month and at 00:00 on the first
- [ ] Daily tab with the Month header and Month switching
- [ ] On-phone check: add three Transactions across two days and two Months and see the totals and grouping right
