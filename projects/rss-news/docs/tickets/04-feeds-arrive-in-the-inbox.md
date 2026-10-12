# 04: Feeds arrive in the Inbox

**What to build:** On first run the approved starter Sources and Folders from `docs/starter-sources.md` are loaded. Every minute the tick fetches the Sources that are due and stores new Items, dropping duplicates by cleaned URL. The owner opens the Inbox and sees all Items newest first, and can filter by Folder. Spec user stories 5, 14, 28 (without Importance), 29, 83.

**Blocked by:** 03 (Sign in)

**Status:** done

**Touches:** sources/catalog, sources/fetching, items, tick, adapters/feed_fetcher, adapters/sqlite/sources, adapters/sqlite/items, web/inbox, pwa/inbox, pwa/shell

**Effort:** medium

- [x] Clock and FeedFetcher ports, each with a real adapter and a fake for tests
- [x] Folders, Sources and Items stored in SQLite; starter Sources loaded once, on first run only
- [x] The tick runs every minute in-process, fetches due Sources with conditional GET (ETag / Last-Modified), parses RSS and Atom, and stores new Items
- [x] Tracking parameters are stripped so the same story with different tracking parameters is stored once
- [x] A Source's failure is logged with the Source and step and doesn't stop other Sources or later tick steps
- [x] `/healthz` reports how long ago the last tick succeeded
- [x] Inbox API: newest first, filter by Folder, paging
- [x] PWA Inbox screen with a Folder filter
- [x] Adapter tests parse saved RSS, Atom and Reddit feeds (one from each starter Source family); API tests drive the tick with the fake FeedFetcher and check the Inbox and duplicates; a Vitest test covers the Folder filter
