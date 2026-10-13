# duit-log: spec

Words in **bold** capitals (Transaction, Wallet, Payback, …) are defined in `GLOSSARY.md`. Decisions 0001–0003 in `docs/decisions/` explain the choices that shape this spec.

## Problem Statement

I pay for almost everything with Touch 'n Go eWallet, GrabPay and ShopeePay, and at the end of the month I have no idea where the money went. Money manager apps such as Money Manager answer that question well, but only if I type in every payment by hand, and I stop doing that after a week. The Wallets already tell me about every payment in a notification, so the information is on my phone; nothing collects it.

Shared meals make it worse. I often pay for the whole table and friends transfer me their share a few minutes later, so a RM120 dinner that cost me RM30 looks like RM120 of food and RM90 of income.

I also want to share the app on GitHub, so it must work for strangers without my server or my API key, and it must not become a privacy problem for the people who install it.

## Solution

duit-log is an Android app that turns Wallet payment notifications into **Transactions** as they arrive. Right after each payment, a **Category Prompt** notification lets me pick a **Category** with one tap and optionally add a **Note**. Anything I don't sort myself is sorted in the **Daily Sort** around 8pm, by remembered **Merchant Rules** first and then by an AI model of my choice, if I've given it a key. A friend's Transfer shortly after a shared Expense is recognised as a **Payback** and reduces that Expense.

The main screen looks and works like a classic money manager (in its own style): the **Month**'s Income, Expenses and **Total** at the top, Transactions grouped by day underneath, a Monthly overview and a Stats donut per Category. Everything can be edited by hand, and cash or card payments can be added with a + button.

Everything stays on the phone. The app ignores every notification that isn't from a Wallet app, and the AI sees only Merchant names and amounts.

## Build order

Each milestone ends in something installable and useful on its own.

1. **Recorder:** the app installs from GitHub, explains and requests notification access, and records the Wallets' notifications (and nothing else) so their real wording can be collected for the Notification Reader.
2. **TNG Expenses on the Month screen:** TNG payments become Expenses on the Daily tab with Income / Expenses / Total. Manual add, edit and delete.
3. **Categories and the Category Prompt:** default Category lists, the Categories screen, the Category Prompt and Merchant Rules.
4. **Grab and Shopee:** GrabPay and ShopeePay capture, Grab as a **Platform**, merging a Shopee notification with its TNG payment.
5. **Income:** Transfers in and out, Paybacks, Refunds, **Excluded**.
6. **Daily Sort:** the 8pm run, the AI providers, the Settings screen, the daily summary.
7. **Overview and safety net:** Monthly and Stats tabs, CSV export, Google backup, first public release.

## User Stories

### Getting the app

1. As a user, I want to download the app as an APK from GitHub Releases, so that I don't need the Play Store.
2. As a user, I want updates to install over the old version without losing my data, so that updating is safe.
3. As a user, I want the README to tell me how to allow restricted settings for a sideloaded app on Android 13 and later, so that I can grant notification access.
4. As the owner, I want every pull request to produce a separate Preview app with its own data, so that I can try an unmerged build without it touching my real Transactions.
5. As a stranger reading the code, I want an MIT licence, so that I know I may use and change it.

### Privacy and permissions

6. As a user, I want a first-run screen that explains in plain words why the app needs notification access and what it does with it, so that I can decide whether to trust it.
7. As a user, I want the app to keep nothing from notifications that aren't posted by a Wallet app, so that my messages, bank alerts and one-time codes never touch its storage or logs.
8. As a user, I want the first-run screen to show me how to switch other apps off in Android's notification access settings if I want that extra layer, so that Android doesn't pass their notifications to the app at all (the app already drops them unread).
9. As a user, I want the AI to receive only the Merchant name, the amount and my Category names, so that nothing else about me leaves the phone.
10. As a user, I want the app to ask for permission to post notifications, so that the Category Prompt can appear.
11. As a user, I want to see when notification access has been lost (for example after an update or a battery optimiser), so that I don't silently stop capturing Transactions.

### Recorder (milestone 1)

12. As the owner, I want the app to record every notification from TNG, Grab and Shopee for a while, so that the Notification Reader can be built from their real wording.
13. As the owner, I want to share the recorded notifications as a text file, so that I can blank out names and amounts and turn them into test samples.
14. As the owner, I want to clear the recordings, so that they don't pile up.

### Capturing Transactions

15. As a user, I want a TNG payment notification to become an Expense within a second, with its amount, time, Merchant and Wallet, so that I never type it in.
16. As a user, I want GrabPay and Grab card payments to be captured from Grab's notifications, so that my rides and food orders are logged.
17. As a user, I want ShopeePay payments to be captured from Shopee's notifications, so that my online shopping is logged.
18. As a user, I want a Shopee order paid with TNG to become one Expense, not two, with the item detail from Shopee, so that my totals are right.
19. As a user, I want Reloads to be ignored, so that moving my own money into TNG doesn't count as spending.
20. As a user, I want shipping and delivery notices to be ignored, so that only payments become Transactions.
21. As a user, I want cashback notifications to be ignored, so that the totals stay simple.
22. As a user, I want the same notification posted twice (or updated) to create only one Transaction, so that nothing is double-counted.
23. As a user, I want a Wallet notification that mentions an amount but can't be read to go into a "Couldn't read" list, so that I can add it by hand and the problem is visible.
24. As a user, I want each Transaction to keep the original notification text, viewable in its details, so that I can see why the app read it the way it did.

### Category Prompt (milestone 3)

25. As a user, I want a notification right after each payment showing the amount and Merchant with three Category buttons, so that I can sort it in one tap.
26. As a user, I want the three buttons to be the Merchant Rule's Category first, then my most used Categories, so that the right one is usually there.
27. As a user, I want an "Add note" text box in the notification, so that I can name the Transaction ("lunch with Ali") without opening the app.
28. As a user, I want tapping the notification to open a small window with every Category and a Note field, so that I can pick one that isn't on the buttons.
29. As a user, I want the prompt to arrive quietly with the Category already picked when a Merchant Rule exists, so that I'm only bothered when the app doesn't know.
30. As a user, I want to swipe the prompt away and have the Transaction sorted later by the Daily Sort, so that ignoring it is fine.
31. As a user, I want to turn the Category Prompt off in Settings (it's on by default), so that I can rely on the Daily Sort alone.
32. As a user, I want the prompt for incoming money to show my Income Categories, so that I can sort Income the same way.

### Categories and Merchant Rules (milestone 3)

33. As a user, I want default Expense Categories (Transport, F&B, Groceries, Shopping, Bills, Entertainment, Education, Tech, Health, Transfers, Other), so that I can start without setup.
34. As a user, I want default Income Categories (Salary, Allowance, Transfers, Other), so that Income is sorted too.
35. As a user, I want to rename, add and delete Categories in each list, so that they fit my life.
36. As a user, when I delete a Category that has Transactions, I want to choose which Category they move to (Other by default), so that nothing is lost.
37. As a user, I want Other to be impossible to delete, so that there's always somewhere for Transactions to go.
38. As a user, I want every Category I pick myself (in the prompt or when editing) to create or update a Merchant Rule, so that the app learns my choices.
39. As a user, I want Grab Transactions to get Transport for rides and F&B for food, and never a Merchant Rule, so that one rule can't mislabel every Grab order.
40. As a user, I want Shopee to be a Platform as well, so that its Category comes from what I bought rather than from a rule.

### Income, Transfers, Paybacks and Refunds (milestone 5)

41. As a user, I want a Transfer I send to a person to be an Expense in Transfers, so that it counts as money out.
42. As a user, I want a Transfer I receive to be Income in Transfers, so that it counts as money in.
42a. As a user, I want a Transfer to or from my own name (set once in Settings) to be an Own Transfer, kept in Transfers but Excluded, so that moving money to my own bank account doesn't count as spending.
43. As a user, I want a Transfer I receive within 2 hours of an Expense larger than it to become a Payback for that Expense, so that paying for the table and being paid back costs me only my share.
44. As a user, I want the Payback to be matched to the most recent such Expense, so that a Grab ride after lunch doesn't take the lunch Payback.
45. As a user, I want several Paybacks on one Expense to add up, so that three friends paying RM30 each turn a RM120 meal into RM30.
46. As a user, I want Paybacks capped at the Expense's amount with the extra counted as Income, so that a Category never goes below zero.
47. As a user, I want the prompt for a matched Payback to say "RM30 from Ali. Payback for Nasi Kandar Pelita (RM120)?" with [Payback] [Income], so that I can correct a wrong guess at once.
48. As a user, I want an ignored Payback prompt to leave it a Payback, so that the common case needs no tap.
49. As a user, I want to turn a Payback into Income, or link any received Transfer to an Expense by hand later, so that late paybacks (after 2 hours) can be counted too.
50. As a user, I want an Expense with Paybacks to show "RM120 − RM90 paid back", so that I can see what happened.
51. As a user, I want a Refund to reduce Expenses in the Category of the purchase it refunds, so that a returned item doesn't inflate both Income and Expenses.
52. As a user, I want to mark any Transaction as Excluded, so that money from my parents or a wrongly captured payment stays in the list but out of every total.

### Daily Sort (milestone 6)

53. As a user, I want every Transaction without a Category to be sorted around 8pm each day, so that my Month is complete without effort.
54. As a user, I want Merchant Rules applied before the AI is asked, so that most Transactions are sorted for free.
55. As a user, I want to choose the AI provider: Anthropic, or any OpenAI-compatible one (DeepSeek, GLM, OpenAI, Gemini, OpenRouter, Ollama) with its base URL and model name, so that I can use whichever I pay for.
56. As a user, I want my API key stored encrypted on the phone and never backed up, so that it can't leak.
57. As a user, I want a "Test connection" button for the AI settings, so that I know the key works before 8pm.
58. As a user without an API key, I want the Daily Sort to put whatever is still unsorted into Other, so that the app works without AI.
59. As a user, I want a Daily Sort that fails (no network, provider down) to retry later and leave Transactions unsorted rather than wrong, so that nothing is guessed silently.
60. As a user, I want an AI answer naming a Category that doesn't exist to be ignored for that Transaction, so that the AI can't invent Categories.
61. As a user, I want to change the Daily Sort time in Settings, so that it fits my day.
62. As a user, I want a quiet daily summary notification after the Daily Sort ("RM87.40 over 6 Transactions today, tap to check"), which I can turn off, so that I can glance at the day.
63. As a user, I want AI-sorted Transactions to be marked as such until I confirm or change them, so that I know which Categories came from the AI.

### Month screen and editing (milestones 2, 7)

64. As a user, I want the Daily tab to show the Month's Income, Expenses and Total at the top, so that I see where I stand at a glance.
65. As a user, I want Transactions grouped by day with each day's subtotal, newest first, so that I can scan the Month.
66. As a user, I want to swipe or tap arrows to move between Months, so that I can look back.
67. As a user, I want Transactions without a Category to stand out, so that I can sort them myself.
68. As a user, I want a Monthly tab with each Month of the year's Income, Expenses and Total, so that I can compare Months.
69. As a user, I want a Stats tab with a donut of the Month's Expenses (or Income) by Category, with amounts and percentages, so that I can see where the money went.
70. As a user, I want a + button to add an Expense or Income by hand with amount, date, Merchant, Category and Note, so that cash and card payments count.
71. As a user, I want to edit every field of a Transaction (amount, date and time, Merchant, Category, Note, Excluded), so that I can fix anything.
72. As a user, I want to delete a Transaction after confirming, so that mistakes can be removed.
73. As a user, I want amounts shown as RM with two decimals, so that they read like my Wallet.

### Safety net (milestone 7)

74. As a user, I want to export all Transactions as a CSV file through the share menu, so that I can keep a copy or open it in a spreadsheet.
75. As a user, I want my Transactions, Categories and Merchant Rules included in Android's Google backup, so that a new phone gets them back.
76. As the owner, I want a shareable log of what the app did (captures, skips, Daily Sort runs, errors) without any notification text or Merchant names, so that I can debug a problem from the phone.

## Implementation Decisions

### Platform and distribution

- Native Kotlin and Jetpack Compose (decision 0001), minimum Android 10 (API 29), targeting the newest stable SDK. Ticket 01 looks up and records current stable versions; it does not assume them. RickNotes in this repo is the model for the build setup; copy from it, never reference it.
- Two variants from one codebase: **duit-log** built from `main` and **duit-log Preview** built from pull requests, with different application IDs, so each has its own data, settings and notification access.
- CI (`name: duit-log`, scoped to the project folder) runs ktlint, detekt, Android lint, the JVM tests and a signed release build. On `main`, when the version name is new, it publishes a GitHub Release `duit-log-v<version>` with the APK; green PRs publish a `duit-log-pr-<N>` prerelease with the Preview APK, deleted when the PR closes. The version code is the CI run number.
- One release signing key, kept outside the repo with a backup and in CI as a secret, as in RickNotes. Updates must be signed with it or Android refuses them.
- MIT licence for this project only.
- Gradle wrapper, version catalog and JDK toolchain pin every tool; a setup script installs the pinned Android SDK so the Beelink and a cloud session can build without Android Studio.

### Module layout

- **`core`**: pure Kotlin, no Android imports. The Ledger, the Notification Reader, the Daily Sort logic, Category and Merchant Rule handling, Month summaries and CSV writing. All money is held as whole sen in a `Long`, never as floating point.
- **`app`**: the Android module with thin adapters: the notification listener, the Category Prompt and summary notifications, the Daily Sort scheduler, the two AI clients, encrypted key storage, the rolling log, and the Compose screens. The Activity only wires things together.
- Storage is SQLite through a library that can run the same schema in JVM tests and on Android (Room with its bundled SQLite driver, or SQLDelight). Ticket 01 checks both and records the choice. Ledger tests run against a real in-memory database, not a fake.

### Seam 1: the Ledger

The main test seam: everything the app decides goes through it, and the UI and Android adapters talk only to it. It takes a clock and its storage. Operations:

- **Capture** a read notification (the Notification Reader's output plus the original text, posting time and Android's notification key). Returns what happened: a new Transaction, merged into an existing one, a Payback match, ignored as a duplicate. Duplicates are recognised by Wallet and notification key: a Wallet re-posts or updates a notification in place under the same key, while two real payments get different keys even when their words and amounts match (the owner's recordings have two RM1.00 Transfers 13 seconds apart, keys differing only in the id). Amount and time alone would merge those two. The same key counts as a duplicate only within an hour of the first posting, in case a Wallet numbers its notifications from 1 again after a restart.
- **Merge rule:** a Shopee payment and a TNG payment of the same amount within 5 minutes, in either order, are one Expense with Wallet TNG, Merchant Shopee and Shopee's item detail.
- **Own Transfer rule:** a Transfer sent to or received from the name set in Settings (compared ignoring case, spaces and punctuation) is captured in Transfers as Excluded and never matched as a Payback. With no name set, every Transfer is a normal one.
- **Payback rule:** a received Transfer (not an Own Transfer) becomes a Payback for the most recent unexcluded Expense posted in the 2 hours before it whose amount is larger than the Transfer and which isn't already fully paid back. The part beyond the Expense's remaining amount becomes Income in Transfers. Paybacks can be confirmed, turned into Income, or linked by hand to any Expense.
- **Refund rule:** a Refund reduces Expenses in the Category of the latest Expense from the same Merchant; if none is found, it uses Other.
- **Platforms:** Grab and Shopee. A Grab ride gets Transport and a Grab food order gets F&B straight from the Notification Reader's detail; Shopee is sorted by the prompt or the Daily Sort. Platforms never get Merchant Rules.
- **Pick Category** (from the prompt or editing): sets the Category, clears any "sorted by AI" mark, and for non-Platform Merchants creates or replaces the Merchant Rule.
- **Edit, delete, set Note, set Excluded** on any Transaction. Changing an Expense's amount re-applies the Payback cap.
- **Add by hand:** Expense or Income with any fields.
- **Categories:** list, add, rename, delete with a move target (Other by default). Other cannot be deleted or renamed. Expense and Income lists are separate; default lists as in stories 33–34.
- **Prompt choices** for a Transaction: the three Category buttons in order (Merchant Rule's Category, then most used in that list over the last 30 days, then defaults), and whether the prompt should be quiet.
- **Month summary:** Income, Expenses, Total, per-day groups with subtotals, per-Category totals and percentages, and the Monthly overview for a year. Paybacks and Refunds reduce Expenses in their Category; Excluded Transactions count nowhere. Months follow the phone's time zone.
- **Daily Sort**, given a Category Sorter port: applies Merchant Rules, then sends what's left to the sorter, then applies valid answers and marks them "sorted by AI". With no sorter configured, leftovers go to Other. A failed sorter call changes nothing and reports the failure for a retry.
- **CSV export:** one row per Transaction with date, time, kind, amount, Category, Merchant, Note, Wallet, Excluded and the Expense a Payback belongs to. No original notification text.
- Failures use the project's own error types (for example, unknown Transaction, Category in use, Other can't be deleted, sorter failed), so the UI can show the right message.

### Seam 2: the Notification Reader

A pure function from a raw notification (posting app's package, title, text, expanded text, time) to one of:

- **Not a Wallet:** the posting app isn't TNG, Grab or Shopee. This is checked first, and the caller drops the notification at once (decision 0003).
- **Ignored**, with a reason: Reload, shipping or delivery notice, cashback, promotion, or nothing money-related.
- **Read:** kind (Expense, Income, Transfer sent, Transfer received, Refund), amount in sen, Merchant, Wallet, and Platform detail where present (Grab ride or food, Shopee item).
- **Unreadable:** from a Wallet app and mentions an amount, but matches no known wording. These go to the "Couldn't read" list.

Each Wallet has its own patterns, built from the samples the recorder collects in milestone 1. The Wallet app package names are confirmed on the owner's phone in ticket 01, not assumed.

### The AI (Category Sorter)

- One port in `core`: given Transactions (id, Merchant, amount, kind) and the Category names for each kind, return a Category name per id. The request contains nothing else (decision 0003).
- Two adapters in `app`: Anthropic Messages API (default model Claude Haiku 5.5), and OpenAI-compatible chat completions (base URL, model name, key). Both ask for a JSON answer and validate it; anything malformed counts as a failed call.
- Timeout of 30 seconds, up to three retries with backoff on network errors and rate limits. Each call logs provider, model, token usage, latency and retries, never Merchant names.
- Without a key, the sorter is absent and the Ledger's no-sorter rule applies.

### Android adapters

- **Notification listener:** passes every notification to the Notification Reader and drops "Not a Wallet" results before any storage or logging. It writes nothing for them, not even a count by app. In milestone 1 it feeds the recorder instead, which stores Wallet notifications only.
- **Category Prompt:** a high-importance notification channel with three action buttons and an inline reply for the Note. Tapping it opens a small dialog-style screen with every Category. A quiet variant is used when a Merchant Rule exists. A Payback match shows [Payback] [Income] instead. No "display over other apps" permission is used.
- **Daily Sort scheduling:** WorkManager, once a day at the chosen time (8pm by default), with a network requirement, and retries with backoff. It may run a few minutes late; that's accepted.
- **Settings** (one validated settings module, stored on the device): AI provider, base URL, model, key, Category Prompt on/off, Daily Sort time, daily summary on/off, your name as banks show it (for Own Transfers). The key is encrypted with an Android Keystore key and excluded from backup. The app has no environment variables; CI's signing secrets are listed in the README.
- **Backup:** Android Auto Backup includes the database and settings except the key and the log.
- **Logging:** a rolling log file on the device with a "Share log" button, as in RickNotes. It records steps and outcomes (captured, ignored and why, unreadable, merged, Daily Sort counts, AI call metrics, errors) but never notification text, Merchant names or Notes.
- **Access lost:** the app checks on start that notification access is still granted and shows a banner with a button to fix it.

### Screens

Daily, Monthly and Stats tabs with the Month header; Transaction details and edit; add by hand (+); Categories; Settings; "Couldn't read" list; first-run notification access guide; Recorder (milestone 1, hidden behind a debug setting afterwards). The layout follows the money manager pattern described in the Solution, in the app's own colours and type, with light and dark themes.

## Testing Decisions

- **What makes a good test:** it drives one of the two seams the way the app does and checks what the user would see: the Month's totals, a Transaction's Category, what the prompt offers, what the AI was sent. It never checks private functions, call order or table layout, so the code behind a seam can be rewritten without touching the tests.
- **Ledger tests** use a real in-memory database, a fake clock and a fake Category Sorter that records what it was sent. They cover at least:
  - a TNG Expense captured and shown in the right day and Month, and the same notification captured twice giving one Transaction
  - Shopee and TNG merging in both orders, inside and outside 5 minutes
  - Paybacks: within and after 2 hours, the most recent larger Expense chosen, three Paybacks adding up, the cap with the extra as Income, turning a Payback into Income, a late Payback linked by hand, the cap re-applied when the Expense amount is edited
  - Refunds reducing the right Category, and the Other fallback
  - Excluded Transactions left out of every total
  - deleting a Category moving its Transactions, and Other refusing deletion
  - Merchant Rules created by a pick, replaced by a later pick, never made for Grab or Shopee, and applied by the Daily Sort before the sorter is called
  - prompt button order and the quiet flag
  - the Daily Sort with no sorter (leftovers to Other), a failing sorter (nothing changes), and an answer naming an unknown Category (ignored)
  - **privacy:** the sorter receives only ids, Merchants, amounts, kinds and Category names; the CSV has no notification text
  - Month boundaries at midnight on the last day, and the Monthly overview
- **Notification Reader tests** run against anonymised real samples kept as test resources (invented samples until milestone 1 has collected real ones). They cover each kind for each Wallet, Reloads, shipping notices, cashback, Unreadable, and **privacy:** a notification from any other app, such as WhatsApp or a bank, is "Not a Wallet" whatever its text says.
- **AI adapter tests** check request building and response parsing against saved example responses, including malformed JSON; no real API calls in tests.
- **Not unit-tested:** the notification listener, notifications, scheduling and Compose screens. Each ticket lists a short on-phone check, run in the Preview app.
- **Prior art:** RickNotes' pure-Kotlin `core` module with JUnit tests mirroring its packages, run with one Gradle command named in the README and in CI.

## Out of Scope

- Budgets and budget warnings
- A calendar view
- Wallet or account balances
- Cashback tracking
- Any currency other than ringgit
- Wallets and banks other than TNG, GrabPay and ShopeePay (the Notification Reader makes adding one a single new set of patterns, later)
- NFC tags
- Reading screenshots or emails
- Sync between devices, a web version, iOS, or any server
- Play Store or F-Droid listing
- Moving the project to its own repository

## Further Notes

- The Notification Reader's patterns can only be written once real notifications have been recorded. Milestone 1 therefore ships the recorder first, and the owner uses TNG, Grab and Shopee for about a week before milestone 2's reader tickets start.
- On Android 13 and later, a sideloaded app's notification access is blocked until "Allow restricted settings" is turned on in its App info. The first-run guide and the README both explain this.
- Wallet apps change their wording without notice. The "Couldn't read" list and the warning in the log are how that shows up; the fix is a new sample and a pattern update.
- The README needs a privacy section that states the two rules of decision 0003 in plain words and links to the code that enforces them.
