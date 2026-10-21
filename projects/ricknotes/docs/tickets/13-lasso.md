# 13: Lasso

**What to build:** The **Lasso** tool lets me draw a loop around my strokes to select them, then drag to move them or delete them. A move or delete is one undo step. The Lasso only ever selects strokes; cutting pictures out of a page is the Snip tool in milestone 7.

**Blocked by:** 12 (Eraser, undo and redo)

**Status:** done

**Touches:** core-session, app-ink

**Effort:** medium

- [x] Strokes inside a drawn loop are selected (deciding what counts as inside is tested in `core`)
- [x] Selected strokes can be dragged to a new position on the same page, or deleted
- [x] Move and delete are each one undo step and are saved (tested)
- [x] Selection is clearly shown and cancelled by tapping outside it
- [x] On-tablet check written in the PR: lasso a block of working, move it down, undo, delete it, undo
