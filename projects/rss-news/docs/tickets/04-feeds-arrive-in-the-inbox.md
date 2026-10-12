# 04: Feeds arrive in the Inbox

**What to build:** On first run the approved starter Sources and Folders from `docs/starter-sources.md` are loaded. Every minute the tick fetches the Sources that are due and stores new Items, dropping duplicates by cleaned URL. The owner opens the Inbox and sees all Items newest first, and can filter by Folder. Spec user stories 5, 14, 28 (without Importance), 29, 83.

**Blocked by:** 03 (Sign in)

**Status:** ready

**Touches:** sources/catalog, sources/fetching, items, tick, adapters/feed_fetcher, adapters/sqlite/sources, adapters/sqlite/items, web/inbox, pwa/inbox, pwa/shell

**Effort:** medium

- [ ] Clock and FeedFetcher ports, each with a real adapter and a fake for tests
- [ ] Folders, Sources and Items stored in SQLite; starter Sources loaded once, on first run only
- [ ] The tick runs every minute in-process, fetches due Sources with conditional GET (ETag / Last-Modified), parses RSS and Atom, and stores new Items
- [ ] Tracking parameters are stripped so the same story with different tracking parameters is stored once
- [ ] A Source's failure is logged with the Source and step and doesn't stop other Sources or later tick steps
- [ ] `/healthz` reports how long ago the last tick succeeded
- [ ] Inbox API: newest first, filter by Folder, paging
- [ ] PWA Inbox screen with a Folder filter
- [ ] Adapter tests parse saved RSS, Atom and Reddit feeds (one from each starter Source family); API tests drive the tick with the fake FeedFetcher and check the Inbox and duplicates; a Vitest test covers the Folder filter
