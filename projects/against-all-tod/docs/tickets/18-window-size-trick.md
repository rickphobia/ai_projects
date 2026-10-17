# 18: Window size trick

**What to build:** The Window size slider joins the Settings menu: up adds an empty lane along the top and bottom edges, giving Dudes a route around the Maze; down closes Spawn line tiles from both ends and squeezes Squads onto the nearest open tile. When a lane closes again, Pieces built on it are crushed.

**Blocked by:** 17 (Volume trick, real sound and sound effects)

**Status:** ready

**Touches:** tricks, battle/tricks, maze, renderer/board, ui/settings

**Effort:** medium

- [ ] Window size follows the same pricing rules as the other sliders
- [ ] Each step up adds one empty row on the top and bottom edges; the route recomputes
- [ ] Each step down closes the outermost Spawn line tiles; their Squads move to the nearest open Spawn line tile
- [ ] Closing a lane destroys any Piece on it
- [ ] The Board frame visibly grows and shrinks
- [ ] Tests: lanes added and removed, routes using new lanes, Squads squeezed, Pieces crushed
