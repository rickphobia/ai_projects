# 02: Build the Maze

**What to build:** On a Defense turn the player can place Crate Walls on the Board with the mouse. The route Dudes will walk from the Spawn line to the Goal is shown and updates after each placement. A placement that would seal the Goal off is refused with a clear message.

**Blocked by:** 01 (Walking skeleton, live on the site)

**Status:** done

**Touches:** maze, catalog/pieces, renderer/board, renderer/pieces, adapters/input, ui/hud

**Effort:** medium

- [x] Pieces snap to tiles; a tile holds one Piece; Spawn line tiles and the Goal can't be built on
- [x] The maze module computes one shortest-route direction field from the Goal over walkable tiles, shared by every Dude
- [x] Placing a Piece that leaves no route from the Spawn line to the Goal is refused with a typed reason and an on-screen message
- [x] The route preview is drawn on the Board and redrawn after each placement
- [x] Catalog holds the Crate Wall entry with its tuning numbers; tests read numbers from the catalog
- [x] Tests: shortest route on an open Board, route bending around walls, sealing placements refused, Spawn line and Goal tiles refused
