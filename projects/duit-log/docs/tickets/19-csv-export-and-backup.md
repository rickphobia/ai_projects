# 19: CSV export and Google backup

**What to build:** Settings gets "Export CSV", which shares a file with every Transaction through the share menu. Android's Google backup copies Transactions, Categories, Merchant Rules and settings to a new phone, but never the API key or the log.

**Blocked by:** 16 (OpenAI-compatible providers), 18 (Stats tab)

**Status:** ready

**Touches:** core/export, app/screens, build

**Effort:** low

- [ ] CSV writer in `core`: one row per Transaction with date, time, kind, amount, Category, Merchant, Note, Wallet, Excluded and the Expense a Payback belongs to; no notification text; tests cover commas and quotes in Notes
- [ ] Export through the share menu from Settings
- [ ] Backup rules include the database and settings and exclude the key and the log
- [ ] On-phone check: export, open the file in a spreadsheet app, and run a backup test with `adb shell bmgr` if available (otherwise note how it was checked)
