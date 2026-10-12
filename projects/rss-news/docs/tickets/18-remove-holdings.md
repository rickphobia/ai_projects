# 18: Remove Holdings

**What to build:** The Watchlist is the owner's only stock list. The owner adds the stocks they own to it by hand, so the read-only Holdings, which only an IBKR sync would ever have filled, go away. Spec user story 18.

**Blocked by:** 17 (Watchlist, ticker Sources and stock mentions)

**Status:** ready

**Touches:** stocks, adapters/sqlite/stocks, scoring, web/stocks, pwa/stocks

**Effort:** low

- [ ] Stocks code, the Stocks API and the PWA Stocks screen deal only with the Watchlist; nothing mentions Holdings any more
- [ ] Ticker Sources, stock mentions in scoring, Briefings and Chat use the Watchlist alone
- [ ] A database migration drops the `holdings` table, which nothing ever wrote to
- [ ] Existing tests are updated, not weakened; an API test shows a migrated database still serves the Watchlist
- [ ] README updated (status, Stocks module, layout); nothing about IBKR is left
