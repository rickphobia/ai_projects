# 24: Drop a screenshot onto a page

**What to build:** Dragging an image (the screenshot preview from the corner, or an image from another app in split screen) onto an open page places it as a **Picture** where I let go, at a sensible size. Pictures are drawn under the ink and above the page, and the pen writes over them. Placing is one undo step. The image is copied into `<pdf name>.assets/` and recorded in the Ink file (format version bumped; older Ink files still open). The original file is never changed. Spec: `docs/specs/revision-log-and-polish.md`.

**Blocked by:** 19 (Prefactor: shared safe saving)

**Status:** ready

**Touches:** core-session, core-inkfile, app-viewer, app-import

**Effort:** medium

- [ ] Ink file stores Pictures; an Ink file written before this opens with no Pictures (tested)
- [ ] Document session places a Picture as one undo step; the image is in `.assets` before the Ink file references it; reopen shows it (tested)
- [ ] Drag and drop on the page view accepts PNG, JPEG and WebP, with read permission for the dropped content
- [ ] An unreadable or non-image drop shows a clear message and is logged (type and size only)
- [ ] README records whether dragging the screenshot preview works on ZUXOS
- [ ] On-tablet check written in the PR: screenshot, drag the preview onto a page, write over it, undo, reopen
