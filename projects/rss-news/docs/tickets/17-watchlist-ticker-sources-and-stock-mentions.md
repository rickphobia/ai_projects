# 17: Watchlist, ticker Sources and stock mentions

**What to build:** The owner edits their Watchlist in the app with US and Bursa `.KL` tickers. Each stock gets its own ticker-news Source in the Stocks Folder automatically, removed when the stock leaves both Holdings and Watchlist. Scoring marks which of the owner's stocks each Item mentions, and the Inbox shows it. Spec user stories 19–22, 26.

**Blocked by:** 16 (Notes)

**Status:** done

**Touches:** stocks, adapters/sqlite/stocks, sources/catalog, scoring, web/stocks, pwa/stocks, pwa/shell

**Effort:** medium

- [x] Watchlist API: list, add, remove; ticker symbols validated for US and `.KL` formats
- [x] Holdings stored (read-only in the API, empty until ticket 18)
- [x] One ticker-news Source per Holding or Watchlist stock, created and removed automatically
- [x] Scoring returns the owner's stocks each Item mentions, and the Item stores them
- [x] PWA Stocks screen; Inbox and Item view show the stocks an Item mentions
- [x] API tests cover validation, Source creation and removal, and mentions from the fake model; a Vitest test covers adding a ticker
