# 33: Drops and missing Documents in Panes

**What to build:** A PDF dropped from another app onto a Pane is copied into the folder of that Pane's current Document, as before, and now opens as a new Tab in that Pane instead of replacing the current Document. A Tab whose Document was moved or renamed outside the app, while open or before a restore, shows "This Document was moved or renamed" with a Close button instead of failing (stories 13, 14). Spec: `docs/specs/milestones-3-4.md`

**Blocked by:** 30 (Split into two Panes)

**Status:** done

**Touches:** app-import, app-panes, core-layout

**Effort:** low

- [x] Layout: a restored Tab whose Document is missing is kept and marked missing, not dropped (tested)
- [x] A PDF dropped onto a Pane opens as a new Tab in that Pane; a dropped image still becomes a Picture on the page
- [x] A missing Document's Tab shows the message and Close; the other Tabs keep working
- [x] The missing case is logged with the file name only
- [x] On-tablet check written in the PR: drop a PDF from Files onto each Pane; rename an open PDF in Files and come back
