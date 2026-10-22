# 28: Two-finger swipe zooms in and out

**What to build:** Bug reported by the owner on 2026-10-23: with **Finger erase** on, swiping with two fingers to scroll makes the page keep zooming in and out. A two-finger swipe should only scroll; zoom should change only when the fingers clearly spread apart or pinch together. Two fingers keep both scrolling and zooming whatever the settings (spec story 31).

Likely cause, to confirm with a failing test first (`/diagnosing-bugs`): once two fingers are down, the touch interpreter turns every move into a pinch whose zoom change is the exact ratio of the fingers' spread before and after, with no dead zone. Two fingers moving together never keep exactly the same spread, and their moves arrive one pointer at a time, so the spread wobbles every frame and the zoom follows it. It only shows with Finger erase on because then two fingers are the only way to scroll.

**Blocked by:** None (can start immediately)

**Status:** ready

**Touches:** core-touch, app-input

**Effort:** medium

- [ ] A test in the touch interpreter reproduces it first: two fingers moving in parallel, with realistic jitter and one-pointer-at-a-time moves, produce zoom changes (fails before the fix)
- [ ] After the fix the same sequence produces scrolling only (zoom change exactly 1), with Finger erase on and off
- [ ] A real pinch still zooms smoothly once the spread changes past a threshold; the threshold is a named setting in `core` with the other touch thresholds
- [ ] Existing touch interpreter tests stay green, none edited to make them pass
- [ ] On-tablet check written in the PR: with Finger erase on, two-finger swipe through a 40-page lecture without the zoom changing, then pinch to zoom and back
