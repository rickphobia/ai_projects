# 41: Not a mistake

**What to build:** Each row of the Red ink list gets **Not a mistake**, which hides that Red mark for good: the badge count drops and it never comes back, even after reopening the Document. The hidden stroke IDs are saved in the Ink file as an optional field. Spec: `docs/specs/red-ink-and-log-pdf.md`. Story 11.

**Blocked by:** 40 (Red ink list)

**Status:** done

**Touches:** core-session, core-inkfile, app-viewer

**Effort:** low

**Owner steps:** the on-tablet check in the PR, in the Preview app.

- [x] Document session: hiding stroke IDs saves like any change, isn't an undo step, and survives reopening (tested)
- [x] An Ink file without the field opens with nothing hidden; the format version doesn't change (tested)
- [x] Hidden IDs are left out of the Red marks
- [x] Logs Not a mistake with the number of strokes; never strokes
- [x] On-tablet check written in the PR: hide a Red mark, close and reopen the Document, it stays hidden
