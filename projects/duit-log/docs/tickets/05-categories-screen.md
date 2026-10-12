# 05: Categories screen

**What to build:** A Categories screen with the Expense and Income lists, where you can rename and add Categories, and delete one. Deleting a Category that has Transactions asks which Category to move them to (Other by default). Other can't be deleted or renamed.

**Blocked by:** 04 (Edit, delete and Exclude)

**Status:** ready

**Touches:** core/categories, app/screens

**Effort:** low

- [ ] Ledger Category operations: list, add, rename, delete with a move target; project errors for a duplicate name and for touching Other
- [ ] Tests: deleting a Category moves its Transactions to the chosen one and the Month's per-Category totals follow; Other refuses delete and rename
- [ ] Categories screen with both lists, reachable from the home screen
- [ ] On-phone check: rename F&B, add a Category, delete one that has Transactions and move them
