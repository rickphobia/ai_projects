# 31: Divider and moving Tabs

**What to build:** The divider between the two Panes drags to resize them and a double-tap makes them equal; the position is part of the restored layout. Dragging a Tab onto the other Pane moves it there (stories 6, 7). Spec: `docs/specs/milestones-3-4.md`

**Blocked by:** 30 (Split into two Panes)

**Status:** ready

**Touches:** app-panes, core-layout

**Effort:** low

- [ ] Layout: set the divider, make equal, move a Tab to the other Pane (moving the last Tab closes its Pane) (tested)
- [ ] Dragging the divider resizes both Panes, with a sensible minimum size for each
- [ ] Double-tapping the divider makes the Panes equal
- [ ] Dragging a Tab onto the other Pane moves it, keeping its page, zoom and undo history
- [ ] On-tablet check written in the PR: resize, double-tap, move a Tab across, restart and see the divider where it was
