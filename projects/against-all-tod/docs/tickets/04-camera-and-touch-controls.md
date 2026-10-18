# 04: Camera and touch controls

**What to build:** On desktop the player zooms with the mouse wheel and pans by dragging. On phones and tablets in landscape they tap to place, pinch to zoom and drag to pan. Tapping or hovering a Piece shows what it does. Holding a phone upright shows a turn-your-device screen.

**Blocked by:** 02 (Build the Maze)

**Status:** done

**Touches:** adapters/input, renderer/camera, ui/device, ui/piece-info

**Effort:** low

- [x] Mouse: wheel zoom toward the cursor, drag to pan, click to place
- [x] Touch: tap to place, pinch to zoom, one-finger drag to pan; a drag never places a Piece by accident
- [x] Zoom and pan are clamped so the Board can't be lost off screen
- [x] Tapping (touch) or hovering (mouse) a Piece shows its name and one-line description; nothing depends on hover alone
- [x] Portrait on a phone shows the turn-your-device screen; landscape hides it
- [x] Tests: screen-to-tile conversion at different zoom and pan values
- [ ] Tried on a real phone; screenshot of landscape and portrait in the PR

**Owner steps:** try the PR preview on a real phone in landscape and portrait, and add the two screenshots to the PR.
