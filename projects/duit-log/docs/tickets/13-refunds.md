# 13: Refunds

**What to build:** A Refund reduces Expenses in the Category of the latest Expense from the same Merchant, or in Other if there isn't one. It never counts as Income.

**Blocked by:** 12 (Paybacks)

**Status:** ready

**Touches:** core/reader, core/ledger

**Effort:** low

- [ ] The Notification Reader reads Refunds from the Wallets' samples (invented samples, marked as such, if none were recorded yet)
- [ ] Refund rule in the Ledger; tests cover the matching Merchant, no match (Other), and the Month's Expenses going down
- [ ] Refunds look different from Expenses in the list
