# 18: Window size trick

**What to build:** The Window size slider joins the Settings menu: up adds an empty lane along the top and bottom edges, giving Dudes a route around the Maze; down closes Spawn zone rows from the top and bottom and pushes the Dudes in them into the nearest open row, closer together than painting allows. A squeezed Dude's painted spot moves with it. When a lane closes again, Pieces built on it are crushed.

**Blocked by:** 17 (Volume trick, real sound and sound effects), 26 (Erase and Dismiss)

**Status:** ready

**Touches:** tricks, battle/tricks, maze, renderer/board, ui/settings

**Effort:** medium

- [ ] Window size follows the same pricing rules as the other sliders
- [ ] Each step up adds one empty row on the top and bottom edges; the route recomputes
- [ ] Each step down closes the outermost Spawn zone rows; their Dudes move to the nearest open row, and their painted spots move with them
- [ ] Closing a lane destroys any Piece on it
- [ ] The Board frame visibly grows and shrinks
- [ ] Tests: lanes added and removed, routes using new lanes, Dudes squeezed, Pieces crushed
