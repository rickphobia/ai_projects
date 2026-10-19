import { describe, expect, it } from "vitest";
import { PIECES } from "../../src/catalog/pieces";
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  spawnZoneTiles,
  type Tile,
} from "../../src/maze/board";
import {
  checkPlacement,
  emptyMaze,
  pieceAt,
  placePiece,
  placedPieces,
  removePiece,
  resizeMaze,
  wallBreakerRoutes,
  type Maze,
} from "../../src/maze/maze";
import { pathToGoal, routeStep } from "../../src/maze/route";

const CRATE_WALL = PIECES["crate-wall"].id;

/** Places every tile in order, failing the test if any is refused. */
function build(tiles: readonly Tile[], maze: Maze = emptyMaze()): Maze {
  return tiles.reduce((current, tile) => {
    const result = placePiece(current, tile, CRATE_WALL);
    if (!result.ok) {
      throw new Error(
        `(${String(tile.column)}, ${String(tile.row)}) refused: ${result.refusal}`,
      );
    }
    return result.maze;
  }, maze);
}

/** A wall down `column` over the given rows. */
function wallDown(column: number, rows: readonly number[]): Tile[] {
  return rows.map((row) => ({ column, row }));
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from }, (_, index) => from + index);
}

describe("the Wall-breakers' routes", () => {
  const nextToWall = { column: 7, row: 6 };

  it("go through the wall when the way round is long", () => {
    const maze = build(wallDown(8, range(0, 13)));
    const { throughWalls } = wallBreakerRoutes(maze, false);
    expect(routeStep(throughWalls, nextToWall)).toBe("right");
    // Ordinary Dudes still walk round by the gap.
    expect(routeStep(maze.route, nextToWall)).toBe("down");
  });

  it("go round a short wall instead of through it", () => {
    const maze = build(wallDown(8, [5, 6, 7]));
    const { throughWalls } = wallBreakerRoutes(maze, false);
    expect(routeStep(throughWalls, nextToWall)).not.toBe("right");
    expect(pathToGoal(throughWalls, nextToWall)).toEqual(
      pathToGoal(maze.route, nextToWall),
    );
  });

  it("lead the Sapper to the nearest wall, or nowhere without one", () => {
    const lone = { column: 3, row: 3 };
    const maze = build([lone, ...wallDown(8, range(0, 13))]);
    const { toNearestWall } = wallBreakerRoutes(maze, false);
    expect(pathToGoal(toNearestWall, { column: 1, row: 3 })).toEqual([
      { column: 1, row: 3 },
      { column: 2, row: 3 },
      lone,
    ]);
    const none = wallBreakerRoutes(emptyMaze(), false).toNearestWall;
    expect(routeStep(none, { column: 1, row: 3 })).toBe("no-route");
  });
});

describe("removing a Piece", () => {
  it("opens its tile and works the route out again", () => {
    const maze = build(wallDown(8, range(0, 13)));
    const hole = { column: 8, row: 6 };
    const broken = removePiece(maze, hole);
    expect(pieceAt(broken, hole)).toBeUndefined();
    expect(placedPieces(broken)).toHaveLength(12);
    expect(routeStep(broken.route, { column: 7, row: 6 })).toBe("right");
    expect(pathToGoal(broken.route, { column: 0, row: 6 }).length).toBeLessThan(
      pathToGoal(maze.route, { column: 0, row: 6 }).length,
    );
  });

  it("leaves the Maze as it is when the tile is empty", () => {
    const maze = build([{ column: 5, row: 5 }]);
    expect(removePiece(maze, { column: 6, row: 6 })).toBe(maze);
  });
});

describe("placing Pieces", () => {
  it("puts a Piece on an open tile", () => {
    const result = placePiece(emptyMaze(), { column: 5, row: 3 }, CRATE_WALL);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(pieceAt(result.maze, { column: 5, row: 3 })).toBe(CRATE_WALL);
    expect(placedPieces(result.maze)).toEqual([
      { pieceId: CRATE_WALL, tile: { column: 5, row: 3 } },
    ]);
  });

  it("leaves the Maze it was given unchanged", () => {
    const before = emptyMaze();
    placePiece(before, { column: 5, row: 3 }, CRATE_WALL);
    expect(placedPieces(before)).toEqual([]);
  });

  it("refuses a second Piece on the same tile", () => {
    const maze = build([{ column: 5, row: 3 }]);
    expect(placePiece(maze, { column: 5, row: 3 }, CRATE_WALL)).toEqual({
      ok: false,
      refusal: "tile-taken",
    });
  });

  it("refuses every Spawn zone tile with its own reason", () => {
    for (const tile of spawnZoneTiles(0)) {
      expect(checkPlacement(emptyMaze(), tile, CRATE_WALL)).toBe("spawn-zone");
    }
    expect(checkPlacement(emptyMaze(), { column: 3, row: 0 }, CRATE_WALL)).toBe(
      null,
    );
  });

  it("refuses the Goal's tiles", () => {
    for (const row of [6, 7]) {
      expect(checkPlacement(emptyMaze(), { column: 21, row }, CRATE_WALL)).toBe(
        "goal",
      );
    }
  });

  it("refuses tiles off the Board", () => {
    expect(
      checkPlacement(
        emptyMaze(),
        { column: BOARD_COLUMNS, row: 0 },
        CRATE_WALL,
      ),
    ).toBe("off-board");
    expect(
      checkPlacement(emptyMaze(), { column: 3, row: -1 }, CRATE_WALL),
    ).toBe("off-board");
  });
});

describe("the Goal is never sealed off", () => {
  it("refuses the last tile of a wall across the whole Board", () => {
    const maze = build(wallDown(10, range(0, BOARD_ROWS - 1)));
    expect(placePiece(maze, { column: 10, row: 13 }, CRATE_WALL)).toEqual({
      ok: false,
      refusal: "seals-goal",
    });
    expect(pieceAt(maze, { column: 10, row: 13 })).toBeUndefined();
  });

  it("refuses closing a ring around the Goal", () => {
    // The Goal's open neighbours: above, below and to its left.
    const maze = build([
      { column: 21, row: 5 },
      { column: 21, row: 8 },
      { column: 20, row: 6 },
    ]);
    expect(checkPlacement(maze, { column: 20, row: 7 }, CRATE_WALL)).toBe(
      "seals-goal",
    );
  });

  it("allows a wall that leaves a one-tile gap", () => {
    const maze = build(wallDown(10, range(0, BOARD_ROWS - 1)));
    expect(checkPlacement(maze, { column: 12, row: 13 }, CRATE_WALL)).toBe(
      null,
    );
  });

  it("allows walling off a pocket the route doesn't need", () => {
    // Boxes in the top-right corner tile, away from every route.
    const maze = build([{ column: 20, row: 0 }]);
    expect(checkPlacement(maze, { column: 21, row: 1 }, CRATE_WALL)).toBe(null);
  });
});

describe("the route", () => {
  it("is the shortest route on an open Board", () => {
    const maze = emptyMaze();
    const path = pathToGoal(maze.route, { column: 0, row: 6 });
    // Straight along row 6: 21 steps from the back of the Spawn zone to the Goal.
    expect(path).toHaveLength(22);
    expect(path.every((tile) => tile.row === 6)).toBe(true);
    expect(path.at(-1)).toEqual({ column: 21, row: 6 });
  });

  it("takes a shortest route from a far corner of the Spawn zone", () => {
    const path = pathToGoal(emptyMaze().route, { column: 0, row: 0 });
    // 21 columns across and 6 rows down.
    expect(path).toHaveLength(21 + 6 + 1);
    expect(path.at(-1)).toEqual({ column: 21, row: 6 });
  });

  it("starts from every Spawn zone tile", () => {
    const maze = build(wallDown(10, range(0, BOARD_ROWS - 1)));
    for (const tile of spawnZoneTiles(0)) {
      expect(pathToGoal(maze.route, tile).at(-1)?.column).toBe(21);
    }
  });

  it("bends around a wall", () => {
    // A wall down column 10 with its only gap at the bottom.
    const maze = build(wallDown(10, range(0, BOARD_ROWS - 1)));
    const path = pathToGoal(maze.route, { column: 0, row: 6 });
    expect(path).toContainEqual({ column: 10, row: 13 });
    expect(path.some((tile) => pieceAt(maze, tile) !== undefined)).toBe(false);
    // Down 7 rows to the gap, across 21 columns, up 6 rows to the Goal.
    expect(path).toHaveLength(7 + 21 + 6 + 1);
  });

  it("updates after each placement", () => {
    const start = { column: 9, row: 6 };
    const open = emptyMaze();
    expect(routeStep(open.route, start)).toBe("right");

    const oneWall = build([{ column: 10, row: 6 }], open);
    expect(routeStep(oneWall.route, start)).toBe("down");

    const twoWalls = build([{ column: 9, row: 7 }], oneWall);
    expect(routeStep(twoWalls.route, start)).toBe("up");
  });

  it("gives every tile one step, shared by every Dude on it", () => {
    const maze = emptyMaze();
    expect(routeStep(maze.route, { column: 21, row: 6 })).toBe("at-goal");
    expect(routeStep(maze.route, { column: 21, row: 5 })).toBe("down");
    expect(routeStep(maze.route, { column: 21, row: 8 })).toBe("up");
    expect(routeStep(maze.route, { column: 20, row: 7 })).toBe("right");
  });

  it("has no step on a Piece or a walled-off pocket", () => {
    const maze = build([
      { column: 20, row: 0 },
      { column: 21, row: 1 },
    ]);
    expect(routeStep(maze.route, { column: 20, row: 0 })).toBe("no-route");
    expect(routeStep(maze.route, { column: 21, row: 0 })).toBe("no-route");
    expect(pathToGoal(maze.route, { column: 21, row: 0 })).toEqual([]);
  });
});

describe("the Maze at another Window size", () => {
  const fullWall = wallDown(10, range(0, BOARD_ROWS));

  it("lets Pieces go on an open lane, but not on one that isn't open", () => {
    expect(
      checkPlacement(emptyMaze(1), { column: 5, row: -1 }, CRATE_WALL),
    ).toBeNull();
    expect(
      checkPlacement(emptyMaze(1), { column: 5, row: -2 }, CRATE_WALL),
    ).toBe("off-board");
    expect(
      checkPlacement(emptyMaze(-1), { column: 1, row: 0 }, CRATE_WALL),
    ).toBe("spawn-zone");
  });

  it("routes Dudes round a wall the whole height of the old Board by a lane", () => {
    expect(() => build(fullWall)).toThrow(/seals-goal/);
    const maze = build(fullWall, emptyMaze(1));
    const path = pathToGoal(maze.route, { column: 0, row: 6 });
    expect(path.at(-1)?.column).toBe(21);
    expect(path.some(({ row }) => row === -1 || row === BOARD_ROWS)).toBe(true);
  });

  it("crushes the Pieces on a lane that closes and keeps the rest", () => {
    const onLanes = [
      { column: 5, row: -2 },
      { column: 6, row: 15 },
      { column: 7, row: -1 },
    ];
    const maze = build([...onLanes, { column: 8, row: 0 }], emptyMaze(2));
    const result = resizeMaze(maze, 1);
    if (!result.ok) throw new Error(result.refusal);
    expect(result.crushed.map(({ tile }) => tile)).toEqual(onLanes.slice(0, 2));
    expect(placedPieces(result.maze).map(({ tile }) => tile)).toEqual([
      { column: 7, row: -1 },
      { column: 8, row: 0 },
    ]);
    expect(result.maze.windowSize).toBe(1);
  });

  it("refuses to close the lane that the only way to the Goal runs along", () => {
    const maze = build(fullWall, emptyMaze(1));
    expect(resizeMaze(maze, 0)).toEqual({ ok: false, refusal: "seals-goal" });
  });

  it("refuses to close the Spawn zone rows that the only way out starts from", () => {
    const maze = build(wallDown(3, range(2, BOARD_ROWS)));
    expect(resizeMaze(maze, -1).ok).toBe(true);
    expect(resizeMaze(maze, -2)).toEqual({ ok: false, refusal: "seals-goal" });
  });

  it("keeps Dudes out of closed Spawn zone rows", () => {
    const maze = emptyMaze(-1);
    expect(pathToGoal(maze.route, { column: 1, row: 0 })).toEqual([]);
    expect(pathToGoal(maze.route, { column: 1, row: 1 }).at(-1)?.column).toBe(
      21,
    );
  });
});
