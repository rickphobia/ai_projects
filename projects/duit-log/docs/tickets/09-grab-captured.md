# 09: Grab captured

**What to build:** GrabPay and Grab card payments become Expenses from Grab's notifications. Grab is a Platform: a ride gets Transport and a food order gets F&B from the notification itself, and Grab never gets a Merchant Rule.

**Blocked by:** 08 (Category Prompt)

**Status:** ready

**Touches:** core/reader, core/ledger

**Effort:** low

- [ ] The owner's anonymised Grab samples kept as test resources; the Notification Reader reads rides and food orders with their Platform detail, and ignores promotions and order-status notices
- [ ] Ledger sets Transport for rides and F&B for food orders; a Grab notification of an unknown kind is left without a Category
- [ ] Picking a Category for a Grab Transaction creates no Merchant Rule; tests cover it
- [ ] On-phone check: take a Grab ride or order GrabFood and see the Expense with the right Category
