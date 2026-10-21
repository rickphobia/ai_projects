# 28: Draw the Board in code

**What to build:** The art kit arrives (decision 0005): shapes drawn with PixiJS and baked into textures once at start-up. With it the Board becomes Bloons-style: two soft shades of grass in a gentle checker instead of grid lines, seeded flowers and tufts, a thick cartoon border with trees and bushes outside it, the Spawn zone as a striped orange-red carpet, the route as a dashed path while building, the Goal as a little office building with its health bar, and Crate Walls as chunky stacked crates with a shadow. Window size lanes and the dark (Brightness down) look right in the new style. See `docs/specs/art-pass.md`, stories 1–10.

**Blocked by:** None (can start immediately)

**Status:** done

**Touches:** renderer/art-kit, renderer/board

**Effort:** medium

- [x] Grass, border, decoration, Spawn carpet, route, Goal and Crate Wall are drawn by the art kit; their Kenney tiles are no longer imported
- [x] Tile edges stay visible enough to place Pieces precisely
- [x] Decoration is placed from the Run's seed: same seed, same Board; never on a Piece, the route or the Goal (unit-tested)
- [x] Window size lanes and Brightness down look right (screenshots of both)
- [x] New colours are named next to the existing ones and as matching CSS variables
- [x] The spec's "Look" section says the Board is drawn in code
- [x] The PR has before and after screenshots at desktop and phone size, and updates the matching file in `docs/screenshots/`
