# 05: Manage Sources and Folders

**What to build:** The owner can add a Source by pasting a feed URL or typing a subreddit name, create, rename and delete Folders, move a Source to another Folder, and pause or remove a Source. Each Source shows when it last fetched successfully and its last error. Spec user stories 6–11.

**Blocked by:** 04 (Feeds arrive in the Inbox)

**Status:** ready

**Touches:** sources/catalog, web/sources, pwa/sources, pwa/shell

**Effort:** low

- [ ] API to list, create, update and delete Folders and Sources; listing includes last success and last error
- [ ] Adding a feed URL checks it once and refuses a URL that isn't a feed, with a clear message
- [ ] Adding a subreddit by name builds its feed URL
- [ ] Deleting a Folder that still has Sources is refused with a clear message
- [ ] Paused Sources are not fetched; removed Sources' Items leave the Inbox
- [ ] PWA Sources and Folders screen
- [ ] API tests cover each action and the refusals; a Vitest test covers adding a subreddit
