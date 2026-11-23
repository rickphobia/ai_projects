# 50: Inserted pages and Pictures in the Export

**What to build:** An Export with ink matches the screen: Inserted pages have their blank, lined, grid or dotted background, and Pictures are drawn where they sit on the page, under the strokes. Spec: `docs/specs/export-with-ink.md`, stories 2 and 3.

**Blocked by:** 49 (Export with ink)

**Status:** ready

**Touches:** core-export, app-export

**Effort:** low

**Owner steps:** the on-tablet check in the PR, in the Preview app.

- [ ] Export plan: Inserted pages carry their background; Pictures come out on the right page, position and size, before that page's strokes; a Document with only Pictures or only Inserted pages is With ink, not Bare (tested)
- [ ] Inserted page backgrounds are drawn as on screen (lines at 8 mm, grid and dots at 5 mm)
- [ ] Pictures are read from the Document's `.assets` folder; a missing Picture file fails the Export with a clear message rather than leaving a gap
- [ ] The Export log line adds the Picture count
- [ ] On-tablet check written in the PR: a Document with a lined and a grid Inserted page and two Pictures with ink over them, exported and opened in another reader
