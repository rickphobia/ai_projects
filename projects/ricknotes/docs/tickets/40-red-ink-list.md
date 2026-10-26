# 40: Red ink list

**What to build:** The Document toolbar shows a "Red ink · N" badge when the Document has **Red marks** that aren't logged yet, and no badge when it has none. Tapping the badge opens a list of the Red marks in page order, each with a small picture and its page number; tapping a row jumps to that page with a box around the Red mark. Rows have no buttons yet (41 and 42 add them). This adds the Red marks seam in `core`. Spec: `docs/specs/red-ink-and-log-pdf.md`. Stories 1–9 and 13–15.

**Blocked by:** None (can start immediately)

**Status:** ready

**Touches:** core-redink, app-viewer

**Effort:** medium

**Owner steps:** the on-tablet check in the PR, in the Preview app.

- [ ] Red marks seam: only red pen strokes count, never the highlighter or other pens (tested)
- [ ] Strokes on one page within the time limit (60 s after the group's last stroke) and the distance limit (a fifth of the page's shorter side) make one Red mark; a stroke past either limit starts another; pages stay separate (tested)
- [ ] A group whose last stroke is under a minute old isn't offered (tested with a fake clock)
- [ ] Left-out stroke IDs are skipped before grouping, and new ink beside them makes a new Red mark (tested)
- [ ] Three red marks on two pages give three Red marks (tested)
- [ ] Both limits are named constants
- [ ] Red marks are recomputed off the main thread when strokes change and once a minute while the Document is open
- [ ] Red ink drawn before this ticket is offered too
- [ ] Outside any Course folder, the badge explains why and points to marking one; marking the folder makes the Red marks show up
- [ ] No badge when the Document or its Revision log is open read-only
- [ ] Logs the number of Red marks found; never strokes
- [ ] On-tablet check written in the PR: mark two questions and a far-apart third on two pages, wait a minute, see "Red ink · 3", jump to each. Note whether the distance limit merges or splits marks wrongly on real tutorial pages
