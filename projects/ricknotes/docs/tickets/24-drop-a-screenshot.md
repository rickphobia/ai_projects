# 24: Drop a screenshot onto a page

**What to build:** Dragging an image (the screenshot preview from the corner, or an image from another app in split screen) onto an open page places it as a **Picture** where I let go, at a sensible size. Pictures are drawn under the ink and above the page, and the pen writes over them. Placing is one undo step. The image is copied into `<pdf name>.assets/` and recorded in the Ink file (format version bumped; older Ink files still open). The original file is never changed. Spec: `docs/specs/revision-log-and-polish.md`.

**Blocked by:** 19 (Prefactor: shared safe saving)

**Status:** done

**Touches:** core-session, core-inkfile, app-viewer, app-import

**Effort:** medium

**Owner steps:** on the tablet, check whether the screenshot preview can be dragged into RickNotes on ZUXOS, and record the result in the README ("Dragging the screenshot preview on ZUXOS").

- [x] Ink file stores Pictures; an Ink file written before this opens with no Pictures (tested)
- [x] Document session places a Picture as one undo step; the image is in `.assets` before the Ink file references it; reopen shows it (tested)
- [x] Drag and drop on the page view accepts PNG, JPEG and WebP, with read permission for the dropped content
- [x] An unreadable or non-image drop shows a clear message and is logged (type and size only)
- [ ] README records whether dragging the screenshot preview works on ZUXOS
- [x] On-tablet check written in the PR: screenshot, drag the preview onto a page, write over it, undo, reopen
