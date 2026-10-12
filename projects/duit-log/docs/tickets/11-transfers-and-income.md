# 11: Transfers and Income

**What to build:** A Transfer you send to a person becomes an Expense in Transfers; a Transfer you receive becomes Income in Transfers. The Category Prompt for incoming money shows the Income Categories. A Transfer to or from your own name, such as a DuitNow Transfer to your own bank account, is an Own Transfer: kept in Transfers but Excluded, so moving your own money isn't counted as spending. You set your name once in Settings, as your bank shows it. TNG's notification for a Transfer to your own account reads exactly like one to a friend, so the name is the only way to tell them apart.

**Blocked by:** 10 (Shopee captured and merged with TNG)

**Status:** ready

**Touches:** core/reader, core/ledger, app/prompt, app/settings

**Effort:** medium

- [ ] The Notification Reader reads TNG (and, if the samples have them, GrabPay and ShopeePay) Transfers sent and received, from anonymised samples
- [ ] Ledger captures sent Transfers as Expenses and received ones as Income, both in Transfers
- [ ] Settings gets "Your name (as your bank shows it)", optional, in the validated settings module
- [ ] Own Transfer rule: a Transfer sent to or received from that name, compared ignoring case, spaces and punctuation, is captured in Transfers as Excluded, and a received one is never matched as a Payback. With no name set, every Transfer is a normal one. Tests cover both, plus a friend's Transfer that isn't affected
- [ ] Own Transfers show as Excluded in the list, and can be switched back to counted by hand, using ticket 04's Excluded
- [ ] The log says "own transfer" as the capture outcome, never the name
- [ ] The prompt and the all-Categories window use the Income list for Income
- [ ] On-phone check: send and receive a small TNG Transfer and see both on the Daily tab; with your name set, a DuitNow Transfer to your own bank account shows as Excluded and leaves the totals unchanged
