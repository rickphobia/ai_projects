# 10: Shopee captured and merged with TNG

**What to build:** ShopeePay payments become Expenses from Shopee's notifications. A Shopee order paid with TNG sends two notifications; when a Shopee and a TNG payment of the same amount arrive within 5 minutes of each other, in either order, they become one Expense with Wallet TNG and Shopee's item detail. Shopee is a Platform. Shipping and delivery notices are ignored.

**Blocked by:** 09 (Grab captured)

**Status:** ready

**Touches:** core/reader, core/ledger

**Effort:** medium

- [ ] The owner's anonymised Shopee samples kept as test resources; the Notification Reader reads ShopeePay payments and order payments with item detail, and ignores shipping, delivery and promotion notices
- [ ] Merge rule in the Ledger; tests cover Shopee first, TNG first, 4 and 6 minutes apart, and two different amounts
- [ ] An existing Category Prompt for the first notification is updated in place, not posted twice
- [ ] No Merchant Rule for Shopee
- [ ] On-phone check: pay a Shopee order with TNG and see one Expense
