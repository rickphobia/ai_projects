# 09: Inbox search and old-Item cleanup

**What to build:** The owner searches their Items by keyword to find something they saw last week. Items older than the configured age (90 days by default) are deleted automatically. Spec user stories 32, 80.

**Blocked by:** 08 (Item view and Reader view)

**Status:** ready

**Touches:** items, adapters/sqlite/items, tick, web/inbox, pwa/inbox

**Effort:** low

- [ ] SQLite full-text search over title, excerpt and one-line summary, combined with the Folder and Importance filters
- [ ] The tick deletes Items older than the configured age, along with their search entries
- [ ] PWA search box in the Inbox
- [ ] API tests cover search and cleanup with the fake Clock; a Vitest test covers the search box
- [ ] README and `.env.example` updated
