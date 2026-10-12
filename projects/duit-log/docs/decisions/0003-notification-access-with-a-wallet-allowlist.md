# Notification access, with a Wallet allowlist and nothing else kept

duit-log captures Transactions through Android's notification access, which hands the app every notification on the phone, not just the Wallets'. Android offers no narrower permission, and none of TNG, Grab or Shopee has an API for your own Transactions. Two rules make this acceptable, and each has a test: the app drops any notification not posted by a Wallet app before doing anything else with it (it is never saved, logged or sent), and the AI is only ever sent a Merchant name, an amount and the Category list, never notification text. The code is open source so anyone can check both rules, and the README shows how to turn other apps off for duit-log in Android's notification access settings (Android 12 and later).

**Considered Options:** sharing screenshots of each Wallet's history for the AI to read. That needs no special permission, but it loses the instant Category Prompt and Paybacks, makes amounts depend on the AI (against 0002), and sends more personal data off the phone, not less.

**Trade-offs:** users must trust the app with a broad permission, and on Android 13 and later a sideloaded app needs "Allow restricted settings" before that permission can be granted.
