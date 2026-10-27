# 42: Add mistake from a Red mark

**What to build:** Each row of the Red ink list gets **Add mistake**. One tap adds a **Mistake** to the Course folder's Revision log with the whole page as its Snips (front without ink, back with ink and a box around the Red mark), then shows "Added to EE2001 · Edit". Edit opens the Entry to set its category and "why". The Red mark leaves the list and is never offered again. Entries gain the red stroke IDs they came from and the box. Spec: `docs/specs/red-ink-and-log-pdf.md`. Stories 10, 16, 18–20.

**Blocked by:** 41 (Not a mistake)

**Status:** done

**Touches:** core-revisionlog, app-revisionlog, app-snip, app-viewer

**Effort:** medium

**Owner steps:** the on-tablet check in the PR, in the Preview app.

- [x] Revision log session: an Entry with red stroke IDs and a box reopens with them (tested)
- [x] New query: every logged red stroke ID for one Document; IDs from another Document aren't included (tested)
- [x] A log written before this ticket opens, with no stroke IDs or boxes; the format version doesn't change (tested)
- [x] Logged stroke IDs are left out of the Red marks, together with the hidden ones from 41
- [x] Snips of the whole page rendered off the main thread with the capped long edge; the back has the box outlined; Snips are written before the Entry
- [x] Category and "why" start empty
- [x] "Open in Document" on the Entry opens its page
- [x] Logs Mistake added from a Red mark (course folder name, Entry ID); never Snips or strokes
- [x] On-tablet check written in the PR: add a Red mark, find the Entry in the Revision log with the whole page and the box, the badge count drops
