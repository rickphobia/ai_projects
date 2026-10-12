# 08: Category Prompt

**What to build:** Right after a Transaction is captured, a Category Prompt notification shows the amount and Merchant with three Category buttons and an "Add note" text box. Tapping the notification opens a small window with every Category and a Note field. When a Merchant Rule exists, the prompt arrives quietly with that Category already picked. Swiping it away leaves the Transaction for the Daily Sort. A Settings screen gets its first switch: Category Prompt on (default) or off.

**Blocked by:** 07 (Merchant Rules)

**Status:** ready

**Touches:** app/prompt, app/settings, core/categories

**Effort:** medium

- [ ] Ledger prompt choices: the three buttons in order (Merchant Rule's Category, then the most used in that list over the last 30 days, then the defaults) and the quiet flag; tests cover the order and ties
- [ ] Prompt notification on its own high-importance channel, with three action buttons and an inline reply for the Note; picking a Category or sending a Note updates the Transaction and the Merchant Rule
- [ ] Tapping opens a dialog-style screen with every Category and a Note field; no "display over other apps" permission
- [ ] Quiet variant (no sound or pop-down) when a Merchant Rule exists
- [ ] Settings screen with the Category Prompt switch, in one validated settings module; off means no prompt is posted
- [ ] On-phone check: pay with TNG, pick a Category from the button, add a Note from the notification, see both in the app
