# 04: Edit, delete and Exclude

**What to build:** Tapping a Transaction opens its details, where every field can be edited (amount, date and time, Merchant, Category, Note) and it can be marked Excluded or deleted. Excluded Transactions stay in the list, look different, and count in no total.

**Blocked by:** 03 (Daily tab with hand-added Transactions)

**Status:** done

**Touches:** core/ledger, core/summary, app/screens

**Effort:** low

- [x] Ledger edit, set Note, set Excluded and delete operations, with the project's own error for an unknown Transaction
- [x] Excluded Transactions are left out of the Month header, day subtotals and every later total; tests cover it
- [x] Details and edit screen; delete asks to confirm
- [x] Excluded Transactions are shown greyed with a label in the list
- [ ] On-phone check (owner, on the Preview APK): edit an amount and see the totals change; exclude it and see it drop out of the totals
