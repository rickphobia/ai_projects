# 30: Split into two Panes

**What to build:** A split button in the toolbar, and Ctrl+\, opens the current Document in a second Pane at the same page: side by side in landscape, stacked in portrait. There are at most two Panes; splitting with two open opens it in the other Pane. The Pane last touched is the **Focused Pane**, shown subtly, and Documents opened from home go there. The same Document in both Panes shares one Document session, so ink appears live in both and there is one undo history, which ends only when the Document's last Tab closes. Closing a Pane's last Tab closes the Pane. Each Pane scrolls, zooms and takes ink on its own. The restored layout includes both Panes and the Focused Pane (stories 1, 2, 4, 8–12). Spec: `docs/specs/milestones-3-4.md`

**Blocked by:** 29 (Tabs in one Pane)

**Status:** done

**Touches:** core-layout, core-session, app-panes, app-viewer

**Effort:** medium

- [x] Layout: split, split with two Panes open, focus, closing the last Tab closes the Pane, two-Pane JSON round-trip (tested)
- [x] A registry in `core` keeps one Document session per open Document, counted by its Tabs; closing one of two Tabs keeps undo, closing the last saves and ends the session (tested)
- [x] Split button and Ctrl+\ open the current Document in the other Pane at the same page
- [x] Landscape shows the Panes side by side, portrait stacks them; rotating never changes the Layout
- [x] A stroke in one Pane shows in the other when both show the same Document
- [x] The Focused Pane is marked, and opening from home goes there
- [x] On-tablet check written in the PR: split a lecture, write in one Pane and watch it appear in the other, undo from the other, rotate, force-close and reopen with both Panes back
