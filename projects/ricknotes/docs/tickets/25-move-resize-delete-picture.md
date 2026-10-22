# 25: Move, resize and delete a Picture

**What to build:** With the Lasso tool, tapping a Picture selects it: I can drag it, resize it by its corner (keeping its shape, staying on its page), or delete it from the floating menu. Each is one undo step. The Lasso loop itself still selects only strokes. Deleting keeps the image file so undo and Versions still work. Spec: `docs/specs/revision-log-and-polish.md`.

**Blocked by:** 16 (Floating Lasso menu), 24 (Drop a screenshot onto a page)

**Status:** ready

**Touches:** core-session, app-ink, app-viewer

**Effort:** low

- [ ] Move, resize and delete are each one undo step and are saved (tested in `core`)
- [ ] Resize keeps the aspect ratio and the Picture stays on its page (tested)
- [ ] Lasso-tool tap on a Picture selects it; a loop still selects only strokes; the pen never moves a Picture
- [ ] Delete keeps the image file in `.assets`
- [ ] On-tablet check written in the PR: select, move, resize, delete, undo each
