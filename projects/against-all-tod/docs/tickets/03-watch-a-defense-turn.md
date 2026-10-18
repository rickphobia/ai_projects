# 03: Watch a Defense turn

**What to build:** The player places Crate Walls and a Sniper Nest, presses Fight, and watches a game-made Army of Interns walk the route toward the Goal. The Sniper Nest shoots the biggest Dude in range. Dudes that reach the Goal damage its health bar and vanish. The battle ends with a winner shown, and the player can watch at 1x, 2x or 4x.

**Blocked by:** 02 (Build the Maze)

**Status:** done

**Touches:** battle/core, battle/events, catalog/pieces, catalog/dudes, renderer/units, renderer/pieces, ui/hud

**Effort:** medium

- [x] Battle is a pure function stepped at a fixed 1/60 s from Board, Army and seed; no DOM or PixiJS in battle code
- [x] Interns follow the shared direction field; Sniper Nest targets the biggest Dude in range
- [x] Goal has a health bar; a Dude reaching it deals damage by kind and vanishes
- [x] Battle ends when the Goal reaches zero (attack wins), no Dudes are left (defense wins) or after 90 s of game time (defense wins)
- [x] Battle emits events (kill, reach Goal) for later gold and reports
- [x] Watch speed 1x/2x/4x changes steps per real second only; a test shows the result is identical at every watch speed
- [x] Test: the same seed and inputs always give the same result
- [x] Units drawn with Kenney sprites in one clear color per side
- [x] Screenshot of a battle in the PR
