# 15: Polished document screen

**What to build:** The Document screen looks finished. The toolbar uses icons instead of text buttons (back, pen, highlighter, eraser, **Lasso**, undo, redo), with the active tool clearly marked and each icon labelled on long-press and for accessibility. The page number shows as "12 / 40" and opens page jump when tapped. The save state stays quiet while saved, and "Not saved" stays clearly visible until a save succeeds. The app follows the tablet's dark mode, while PDF pages stay white. Spec: `docs/specs/revision-log-and-polish.md`.

**Blocked by:** None (can start immediately)

**Status:** ready

**Touches:** app-toolbar, app-viewer, app-theme

**Effort:** low

- [ ] Icon toolbar with the active tool clearly marked; every icon has a long-press label and a content description
- [ ] Only the icons used are bundled; the PR states the APK size before and after
- [ ] Tapping the "12 / 40" indicator opens page jump
- [ ] Saved state is quiet; "Not saved" stays until a save succeeds (same behaviour as today)
- [ ] Material 3 light and dark themes follow the system setting; page renders are never tinted
- [ ] On-tablet check written in the PR: switch tools, undo/redo, jump to a page, toggle the tablet's dark mode
