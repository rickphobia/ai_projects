# 16: Floating Lasso menu

**What to build:** When the **Lasso** selects strokes, a small menu appears beside the selection instead of a toolbar button. It holds Delete for now; later tickets add Add mistake, Add key point and Picture actions. The menu stays on screen near the page edges and moves with the selection while it's dragged. Spec: `docs/specs/revision-log-and-polish.md`.

**Blocked by:** 15 (Polished document screen)

**Status:** ready

**Touches:** app-ink, app-viewer

**Effort:** low

- [ ] A Lasso selection shows a floating menu beside it with Delete; the old toolbar Delete button is gone
- [ ] The menu stays fully on screen near page and screen edges, and follows the selection while dragging
- [ ] The menu is built so later tickets can add actions without restructuring it
- [ ] Delete is still one undo step (existing tests stay green)
- [ ] On-tablet check written in the PR: lasso near each screen edge, drag, delete, undo
