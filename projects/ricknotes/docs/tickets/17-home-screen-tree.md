# 17: Home screen tree

**What to build:** The home screen shows a row of Recent Documents (the last 8 opened) above a browse-only folder tree of the **Study folder** (Year → Sem → Course → …). The tree opens on the semester I used most recently, and courses and chapters can be collapsed. It hides Ink files, `.assets`, `.versions`, `_revision_log` and temporary files. Creating, renaming and moving stay in milestone 3. This adds the Study folder seam in `core`. Spec: `docs/specs/revision-log-and-polish.md`.

**Blocked by:** None (can start immediately)

**Status:** ready

**Touches:** core-studyfolder, app-home, app-files, app-settings

**Effort:** medium

- [ ] `core` Study folder seam lists folders and PDFs and hides app files (tested with a real temporary folder)
- [ ] Recent Documents (last 8) are kept in app settings and shown at the top (ordering tested)
- [ ] The tree opens with the most recently used semester expanded; folders collapse and expand
- [ ] Listing runs off the main thread; a large Study folder doesn't freeze the screen
- [ ] On-tablet check written in the PR: open a Document from the tree, go back, see it in Recent
