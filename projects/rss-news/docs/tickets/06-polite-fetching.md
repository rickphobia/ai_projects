# 06: Polite fetching

**What to build:** Fetching behaves like a polite client so sites, and Reddit in particular, keep serving us. Spec user stories 12–13.

**Blocked by:** 04 (Feeds arrive in the Inbox)

**Status:** ready

**Touches:** sources/fetching, adapters/feed_fetcher

**Effort:** medium

- [ ] Requests to one host go one at a time
- [ ] Reddit requests are spaced by the configured gap (10 seconds by default) and each subreddit is checked at most every configured interval (60 minutes by default)
- [ ] A rate-limited answer's retry delay is honoured before that host is asked again
- [ ] A failing Source backs off exponentially and is never disabled automatically
- [ ] The FeedFetcher adapter turns a 429 with `Retry-After` into the rate-limited result
- [ ] API tests with the fake Clock and FeedFetcher cover spacing, interval, retry delay and backoff
- [ ] README and `.env.example` updated
