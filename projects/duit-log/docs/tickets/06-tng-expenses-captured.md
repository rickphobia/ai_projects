# 06: TNG Expenses captured

**What to build:** A TNG payment becomes an Expense on the Daily tab within a second of its notification, with amount, time, Merchant and Wallet, and the original notification text kept in its details. Reloads, promotions and other non-payment TNG notifications are ignored. A TNG notification that mentions an amount but can't be read goes to a "Couldn't read" list. See decision 0002.

**Blocked by:** 02 (Recorder), 05 (Categories screen)

**Status:** ready

**Touches:** core/reader, core/ledger, app/capture, app/screens

**Effort:** medium

- [ ] The owner's anonymised TNG samples kept as test resources; the Notification Reader's TNG patterns read each one to the right kind, amount in sen, Merchant and Wallet, or to Ignored with the right reason (Reload, promotion, cashback, nothing money-related), or Unreadable
- [ ] Ledger capture: a new Expense without a Category; the same notification posted twice or updated in place gives one Transaction (recognised by Wallet, amount and posting time); tests cover both
- [ ] The listener sends Wallet notifications to the Reader and the Ledger instead of the recorder; the recorder stays reachable behind a debug setting
- [ ] Transactions without a Category stand out in the list
- [ ] "Couldn't read" list screen showing the original text, with a button that opens add-by-hand pre-filled with the time
- [ ] Original notification text shown in the Transaction's details; never in the log
- [ ] The log records each capture outcome (captured, ignored and why, unreadable, duplicate) with Wallet and time, never text or Merchant
- [ ] On-phone check: pay with TNG and see the Expense appear; Reload TNG and see nothing
