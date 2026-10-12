# duit-log

A personal Android money log that picks up e-wallet payments from the phone's notifications and sorts each one into a Category, so you can see your Income, Expenses and Total each Month.

## Money

**Transaction**:
One logged movement of money: either an Expense or an Income, with an amount, a time, a Merchant and a Category.
_Avoid_: Spend, entry, record, payment

**Expense**:
A Transaction where money left you, including a Transfer you sent to a person.
_Avoid_: Spend, cost, outgoing

**Income**:
A Transaction where money came to you, including a Transfer a person sent you.
_Avoid_: Earning, incoming, negative expense

**Total**:
A Month's Income minus its Expenses.
_Avoid_: Balance, net

**Wallet**:
An e-wallet whose notifications the app reads to capture Transactions (Touch 'n Go eWallet, GrabPay, ShopeePay).
_Avoid_: Account, app

**Merchant**:
Who the money went to or came from, as named in the notification.
_Avoid_: Payee, shop, vendor

**Platform**:
A Merchant that sells more than one kind of thing, such as Grab (rides and food). A Platform never gets a Merchant Rule; its Category comes from what was bought.

**Note**:
Your own optional name for a Transaction, e.g. "lunch with Ali".
_Avoid_: Description, label, memo

**Transfer**:
Money sent to or received from a person rather than a business; an Expense when sent, an Income when received.
_Avoid_: DuitNow, send money

**Payback**:
A Transfer from a person covering their share of an Expense you paid for, such as a shared meal. It reduces that Expense instead of counting as Income; anything beyond the Expense's amount is Income.
_Avoid_: Split, reimbursement, refund

**Refund**:
Money a business returns for an earlier purchase. It reduces Expenses in that purchase's Category; it is never Income.

**Reload**:
Moving your own money into a Wallet, e.g. a TNG top-up from your bank. Never a Transaction.
_Avoid_: Top-up

**Excluded**:
A Transaction kept in the list but left out of every total, e.g. money from your parents you don't want counted as Income.
_Avoid_: Hidden, ignored

**Month**:
A calendar month, 1st to last day. Every amount is in ringgit (MYR).

## Capturing

**Notification Reader**:
The part of the app that decides what a posted notification is: Not a Wallet, or (from ticket 06) a read Transaction, Ignored or Unreadable.
_Avoid_: Parser, scraper

**Not a Wallet**:
The Notification Reader's verdict on a notification whose posting app isn't a Wallet app. It is dropped at once, its text unread, and never saved, logged or counted.

**Recorder**:
The milestone 1 screen and storage that keep every Wallet notification as Android posted it, so the Notification Reader can be built from real wording.
_Avoid_: Capture log, sample collector

## Sorting

**Category**:
A bucket a Transaction belongs to, such as Transport or F&B. Expenses and Income have separate lists; each starts from a default list you can rename, add to and delete from.
_Avoid_: Tag, type, group

**Other**:
The Category in each list that always exists and cannot be deleted; Transactions from a deleted Category can be moved here.

**Merchant Rule**:
A remembered pairing of a Merchant to a Category, made or updated whenever you pick a Category yourself, so that Merchant's later Transactions get it without asking the AI.
_Avoid_: Mapping, memory

**Daily Sort**:
The once-a-day run, around 8pm, that gives a Category to every Transaction that still has none.
_Avoid_: Batch, sync, nightly job

**Category Prompt**:
The notification shown right after a Transaction is captured, asking you to pick its Category and optionally write a Note. On by default; can be turned off.
_Avoid_: Pop-up, dialog, Spend Prompt
