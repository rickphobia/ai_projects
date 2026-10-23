# 16: Floating Lasso menu

**What to build:** When the **Lasso** selects strokes, a small menu appears beside the selection instead of a toolbar button. It holds Delete for now; later tickets add Add mistake, Add key point and Picture actions. The menu stays on screen near the page edges and moves with the selection while it's dragged. Spec: `docs/specs/revision-log-and-polish.md`.

**Blocked by:** 15 (Polished document screen)

**Status:** done

**Touches:** app-ink, app-viewer

**Effort:** low

- [x] A Lasso selection shows a floating menu beside it with Delete; the old toolbar Delete button is gone
- [x] The menu stays fully on screen near page and screen edges, and follows the selection while dragging
- [x] The menu is built so later tickets can add actions without restructuring it
- [x] Delete is still one undo step (existing tests stay green)
- [x] On-tablet check written in the PR: lasso near each screen edge, drag, delete, undo
