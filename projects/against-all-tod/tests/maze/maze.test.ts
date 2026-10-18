import { describe, expect, it } from "vitest";
import { PIECES } from "../../src/catalog/pieces";
import { BOARD_COLUMNS, BOARD_ROWS, type Tile } from "../../src/maze/board";
import {
  checkPlacement,
  emptyMaze,
  pieceAt,
  placePiece,
  placedPieces,
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

  it("refuses every Spawn line tile", () => {
    for (let row = 0; row < BOARD_ROWS; row++) {
      expect(checkPlacement(emptyMaze(), { column: 0, row }, CRATE_WALL)).toBe(
        "spawn-line",
      );
    }
  });

  it("refuses the Goal's tiles", () => {
    for (const row of [6, 7]) {
      expect(checkPlacement(emptyMaze(), { column: 19, row }, CRATE_WALL)).toBe(
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
      { column: 19, row: 5 },
      { column: 19, row: 8 },
      { column: 18, row: 6 },
    ]);
    expect(checkPlacement(maze, { column: 18, row: 7 }, CRATE_WALL)).toBe(
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
    const maze = build([{ column: 18, row: 0 }]);
    expect(checkPlacement(maze, { column: 19, row: 1 }, CRATE_WALL)).toBe(null);
  });
});

describe("the route", () => {
  it("is the shortest route on an open Board", () => {
    const maze = emptyMaze();
    const path = pathToGoal(maze.route, { column: 0, row: 6 });
    // Straight along row 6: 19 steps from the Spawn line to the Goal.
    expect(path).toHaveLength(20);
    expect(path.every((tile) => tile.row === 6)).toBe(true);
    expect(path.at(-1)).toEqual({ column: 19, row: 6 });
  });

  it("takes a shortest route from a far corner of the Spawn line", () => {
    const path = pathToGoal(emptyMaze().route, { column: 0, row: 0 });
    // 19 columns across and 6 rows down.
    expect(path).toHaveLength(19 + 6 + 1);
    expect(path.at(-1)).toEqual({ column: 19, row: 6 });
  });

  it("bends around a wall", () => {
    // A wall down column 10 with its only gap at the bottom.
    const maze = build(wallDown(10, range(0, BOARD_ROWS - 1)));
    const path = pathToGoal(maze.route, { column: 0, row: 6 });
    expect(path).toContainEqual({ column: 10, row: 13 });
    expect(path.some((tile) => pieceAt(maze, tile) !== undefined)).toBe(false);
    // Down 7 rows to the gap, across 19 columns, up 6 rows to the Goal.
    expect(path).toHaveLength(7 + 19 + 6 + 1);
  });

  it("updates after each placement", () => {
    const first = build([{ column: 10, row: 6 }]);
    expect(routeStep(first.route, { column: 9, row: 6 })).not.toBe("right");
    const opened = emptyMaze();
    expect(routeStep(opened.route, { column: 9, row: 6 })).toBe("right");
  });

  it("gives every tile one step, shared by every Dude on it", () => {
    const maze = emptyMaze();
    expect(routeStep(maze.route, { column: 19, row: 6 })).toBe("at-goal");
    expect(routeStep(maze.route, { column: 19, row: 5 })).toBe("down");
    expect(routeStep(maze.route, { column: 19, row: 8 })).toBe("up");
    expect(routeStep(maze.route, { column: 18, row: 7 })).toBe("right");
  });

  it("has no step on a Piece or a walled-off pocket", () => {
    const maze = build([
      { column: 18, row: 0 },
      { column: 19, row: 1 },
    ]);
    expect(routeStep(maze.route, { column: 18, row: 0 })).toBe("no-route");
    expect(routeStep(maze.route, { column: 19, row: 0 })).toBe("no-route");
    expect(pathToGoal(maze.route, { column: 19, row: 0 })).toEqual([]);
  });
});
