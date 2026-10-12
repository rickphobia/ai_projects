# 08: Item view and Reader view

**What to build:** The owner opens an Item and sees its one-line summary, Source, time and Importance, with a button to the original page and a Reader view button. Opening an Item marks it read. Reader view fetches and cleans the article only when pressed and keeps no copy. Spec user stories 31, 34–37.

**Blocked by:** 05 (Manage Sources and Folders), 07 (Score new Items)

**Status:** ready

**Touches:** items, web/items, adapters/article_extractor, pwa/item, pwa/shell

**Effort:** low

- [ ] ArticleExtractor port with a trafilatura adapter and a fake
- [ ] API to show one Item, mark it read, and return its Reader view text
- [ ] Unread Items are marked in the Inbox
- [ ] Reader view stores nothing; when extraction fails the owner sees a clear message and the original link
- [ ] PWA Item view screen
- [ ] Adapter test against a saved article page; API tests cover read state and the extraction failure; a Vitest test covers the Item view
