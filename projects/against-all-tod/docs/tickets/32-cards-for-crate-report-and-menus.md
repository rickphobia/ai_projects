# 32: Cards for the crate, report, end screen and Pause

**What to build:** The Draft Crate, the Round report, the end screen, the Pause menu and the Piece info become cards with a title ribbon in the shared style from ticket 31. See `docs/specs/art-pass.md`, stories 37 and 42.

**Blocked by:** 31 (Chunky cartoon UI and the top bar)

**Status:** ready

**Touches:** ui/crate, ui/report, ui/end-screen, ui/pause, ui/piece-info

**Effort:** low

- [ ] Each of the five overlays uses the shared card and ribbon styles
- [ ] Their buttons are at least 44 px tall on touch
- [ ] Existing UI tests still pass without being weakened
- [ ] The PR has before and after screenshots at desktop and phone size, and updates the matching file in `docs/screenshots/`
