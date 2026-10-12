# 07: Merchant Rules

**What to build:** Whenever you pick a Category yourself, the app remembers it for that Merchant as a Merchant Rule, and the next capture from that Merchant gets the Category straight away.

**Blocked by:** 06 (TNG Expenses captured)

**Status:** ready

**Touches:** core/categories, core/ledger

**Effort:** low

- [ ] Ledger "pick Category" creates the Merchant Rule, or replaces it when you pick a different Category later
- [ ] Capture applies an existing Merchant Rule
- [ ] Deleting a Category moves its Merchant Rules to the move target
- [ ] Tests: pick, re-pick, capture with and without a rule, Category deleted
- [ ] On-phone check: set the Category of a TNG Expense, pay the same Merchant again, see the Category already set
