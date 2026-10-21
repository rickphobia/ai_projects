# 14: Palm safety and finger gestures

**What to build:** My palm can rest on the screen while I write without ever marking or erasing anything. Two fingers always scroll and zoom. In Settings I can switch on **Finger erase** (off by default), after which one finger erases whole strokes instead of scrolling, and switch on two-finger tap for undo and three-finger tap for redo. See the spec's Touch interpreter section. This completes milestone 2.

**Blocked by:** 12 (Eraser, undo and redo)

**Status:** done

**Touches:** core-touch, app-input, app-settings

**Effort:** medium

**Owner steps:** the on-tablet check and the Milestone 2 gate below, on the Preview app.

- [x] Finger touches are ignored while the pen hovers and for about 0.5 s after it lifts (tested)
- [x] Touches larger than a fingertip are ignored, and touches Android marks as a palm or cancels are dropped (tested)
- [x] Finger erase setting, off by default; when on, one finger erases whole strokes, one undo step per gesture (tested)
- [x] Two-finger tap undo and three-finger tap redo, each with its own switch (tested)
- [x] Thresholds are named settings in `core`, not numbers scattered through the code
- [x] The app passes contact size, hover state and Android's palm/cancel flags through to `core`
- [x] On-tablet check written in the PR: write a page with the palm resting; turn on Finger erase and erase with a finger; tap to undo and redo
- [x] **Milestone 2 gate**, written in the PR for the owner: write, force-close, reopen with all ink there; a page of tutorial working feels as good as Nebo; a resting palm never marks or erases
