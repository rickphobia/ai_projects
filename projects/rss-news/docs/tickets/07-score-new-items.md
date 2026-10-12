# 07: Score new Items

**What to build:** Every new Item gets an Importance from 1 to 5 and a one-line English summary from the scoring model, in batches. Every AI call is recorded in the spending ledger. The Inbox shows both and can be sorted and filtered by Importance. Spec user stories 23–25, 27, 28, 30, 75, 79.

**Blocked by:** 04 (Feeds arrive in the Inbox)

**Status:** done

**Touches:** scoring, spending, adapters/language_model, adapters/sqlite/spending, adapters/sqlite/items, items, tick, web/inbox, pwa/inbox

**Effort:** medium

**Owner steps:** before deploying, add `RSS_NEWS_ANTHROPIC_API_KEY=<your key>` to `~/homelab/env/rss-news.env`; without it the new container won't start (the old one keeps serving).

- [x] LanguageModel port with a score-Items operation, a real Anthropic adapter (timeouts, retries with backoff) and a scripted fake that returns usage
- [x] Models per job and prices per model come from config; the scoring model defaults to `claude-haiku-5-5`
- [x] The tick scores unscored Items in batches that stay under 100K prompt tokens; failed Items are retried on a later tick and never block the Inbox
- [x] Malay-language Items get an English summary
- [x] Spending ledger stores one row per AI call (feature, model, tokens, web searches, cost, duration); AI calls are logged with model, tokens, cost and latency
- [x] Inbox shows Importance and the one-line summary, and can be sorted and filtered by Importance
- [x] Adapter test against a saved Anthropic scoring response; API tests cover scoring, retries and ledger rows; a Vitest test covers the Importance filter
- [x] README and `.env.example` updated (API key, models, prices)
