# 44: No duplicates from the Lasso or deletes

**What to build:** Lassoing a question and tapping Add mistake counts the red strokes inside the loop as logged, so that Red mark leaves the Red ink list. Deleting an Entry from the Revision log screen keeps its red stroke IDs logged, so the red ink doesn't come back. Erasing red ink never touches an Entry. Spec: `docs/specs/red-ink-and-log-pdf.md`. Stories 21, 22 and 24.

**Blocked by:** 42 (Add mistake from a Red mark)

**Status:** done

**Touches:** core-revisionlog, app-ink

**Effort:** low

**Owner steps:** the on-tablet check in the PR, in the Preview app.

- [x] Lasso Add mistake stores the red stroke IDs inside its loop, and no box (tested at the Revision log seam)
- [x] Delete moves an Entry's red stroke IDs to the log's deleted list; they stay among the logged IDs after reopening (tested)
- [x] A log without the deleted list opens (tested)
- [x] On-tablet check written in the PR: Lasso a red-marked question and Add mistake, the badge drops; delete a Red mark Entry, it doesn't come back
