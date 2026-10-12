# 15: AI sorting with Anthropic

**What to build:** With an Anthropic API key in Settings, the Daily Sort asks Claude Haiku 5.5 to choose a Category for whatever Merchant Rules didn't sort. AI-sorted Transactions are marked until you confirm or change them. A "Test connection" button checks the key. The AI is sent only Merchant names, amounts, kinds and Category names. See decisions 0001 and 0003.

**Blocked by:** 14 (Daily Sort without AI)

**Status:** ready

**Touches:** core/sorting, app/ai, app/settings

**Effort:** medium

- [ ] Category Sorter port in `core`; the Daily Sort applies valid answers, marks them "sorted by AI", ignores an answer naming an unknown Category, and changes nothing when the call fails (it is retried later)
- [ ] Privacy test: the request the sorter receives contains only ids, Merchants, amounts, kinds and Category names
- [ ] Anthropic adapter: Messages API, model from settings (default Claude Haiku 5.5), JSON answer validated; 30 s timeout, up to three retries with backoff on network errors and rate limits; request building and response parsing tested against saved example responses including malformed JSON, no real API calls
- [ ] Each call logs provider, model, token usage, latency and retries, never Merchant names
- [ ] Settings: provider, model and key; the key encrypted with an Android Keystore key and excluded from backup; "Test connection" shows success or the provider's error in plain words
- [ ] Picking a Category clears the "sorted by AI" mark
- [ ] On-phone check: add the key, test it, run the Daily Sort early and see AI-sorted Transactions marked

**Owner steps:** paste your Anthropic API key into Settings.
