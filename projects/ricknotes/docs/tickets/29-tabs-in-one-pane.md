# 29: Tabs in one Pane

**What to build:** The Document screen becomes one **Pane** with **Tabs**. Opening a Document from the home screen or Recent Documents adds a Tab (or selects its Tab if it is already open); the tab bar scrolls when full; tapping a Tab switches to it, keeping each Tab's page, zoom and undo history; Ctrl+W and the Tab's close button close it. Only the selected Tab draws pages. Back goes home and keeps the Tabs, and the Tabs with their pages and zoom come back after restarting the app. This adds the Layout seam in `core` (stories 3, 10–12). Spec: `docs/specs/milestones-3-4.md`

**Blocked by:** None (can start immediately)

**Status:** done

**Touches:** core-layout, app-panes, app-viewer, app-settings

**Effort:** medium

- [x] Layout seam in `core`: open a Document (new Tab, or select an open one), select and close Tabs, JSON round-trip (tested)
- [x] Layout is saved in app settings on every change and restored on start; a damaged saved Layout starts empty with a warning in the log (tested)
- [x] Tab bar in the Document screen; switching Tabs keeps each one's page, zoom and undo history
- [x] Only the selected Tab renders pages
- [x] Ctrl+W closes the current Tab; closing the last Tab goes to the home screen
- [x] On-tablet check written in the PR: open three Documents, write in each, switch between them, undo in the first, force-close, reopen with all three Tabs at their pages
