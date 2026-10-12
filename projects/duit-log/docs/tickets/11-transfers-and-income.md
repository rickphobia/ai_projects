# 11: Transfers and Income

**What to build:** A Transfer you send to a person becomes an Expense in Transfers; a Transfer you receive becomes Income in Transfers. The Category Prompt for incoming money shows the Income Categories.

**Blocked by:** 10 (Shopee captured and merged with TNG)

**Status:** ready

**Touches:** core/reader, core/ledger, app/prompt

**Effort:** low

- [ ] The Notification Reader reads TNG (and, if the samples have them, GrabPay and ShopeePay) Transfers sent and received, from anonymised samples
- [ ] Ledger captures sent Transfers as Expenses and received ones as Income, both in Transfers
- [ ] The prompt and the all-Categories window use the Income list for Income
- [ ] On-phone check: send and receive a small TNG Transfer and see both on the Daily tab
