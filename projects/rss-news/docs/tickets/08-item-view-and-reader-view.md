# 08: Item view and Reader view

**What to build:** The owner opens an Item and sees its one-line summary, Source, time and Importance, with a button to the original page, and the full article in Reader view loads underneath right away, so the owner reads it in the app instead of jumping to the source. Opening an Item marks it read. Reader view fetches and cleans the article only when that Item is opened and keeps no copy. Spec user stories 31, 34–37.

**Blocked by:** 05 (Manage Sources and Folders), 07 (Score new Items)

**Status:** done

**Touches:** items, web/items, adapters/article_extractor, pwa/item, pwa/shell

**Effort:** low

- [x] ArticleExtractor port with a trafilatura adapter and a fake
- [x] API to show one Item, mark it read, and return its Reader view text
- [x] Unread Items are marked in the Inbox
- [x] The Item view shows the summary at once and loads Reader view on open, with a loading state, without a button press
- [x] Reader view stores nothing; when extraction fails the owner sees a clear message and the original link
- [x] PWA Item view screen
- [x] Adapter test against a saved article page; API tests cover read state and the extraction failure; a Vitest test covers the Item view
