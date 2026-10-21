import { describe, expect, it } from "vitest";
import { TILE_SIZE } from "../../../src/adapters/renderer/board-textures";
import { boardPixelFrame } from "../../../src/adapters/renderer/board-view";
import {
  groundDecorations,
  surroundPlants,
} from "../../../src/adapters/renderer/decoration";
import { routeStretches } from "../../../src/adapters/renderer/route-view";
import { goalTiles, tileKey, tileKind } from "../../../src/maze/board";
import { emptyMaze, placePiece, type Maze } from "../../../src/maze/maze";

function withWalls(maze: Maze, column: number, rows: readonly number[]): Maze {
  return rows.reduce((current, row) => {
    const result = placePiece(current, { column, row }, "crate-wall");
    if (!result.ok)
      throw new Error(`Could not place a wall on row ${String(row)}`);
    return result.maze;
  }, maze);
}

const MAZE = withWalls(emptyMaze(), 8, [2, 3, 4, 5, 6, 7, 8, 9]);

describe("groundDecorations", () => {
  it("is the same for the same seed and the same Maze", () => {
    expect(groundDecorations(7, MAZE)).toEqual(groundDecorations(7, MAZE));
  });

  it("differs between seeds", () => {
    expect(groundDecorations(7, MAZE)).not.toEqual(groundDecorations(8, MAZE));
  });

  it("scatters some flowers and tufts over the grass", () => {
    const decorations = groundDecorations(7, MAZE);
    expect(decorations.length).toBeGreaterThan(5);
    expect(new Set(decorations.map(({ kind }) => kind))).toEqual(
      new Set(["flower", "tuft"]),
    );
  });

  it("never lands on a Piece, the route, the Goal or the Spawn zone", () => {
    for (const seed of [1, 7, 42, 9001]) {
      const decorated = groundDecorations(seed, MAZE).map(({ tile }) => tile);
      const route = new Set(
        routeStretches(MAZE.route, MAZE.windowSize).flatMap(({ from, to }) => [
          tileKey(from),
          tileKey(to),
        ]),
      );
      const goal = new Set(goalTiles().map(tileKey));
      for (const tile of decorated) {
        expect(MAZE.pieces.has(tileKey(tile))).toBe(false);
        expect(route.has(tileKey(tile))).toBe(false);
        expect(goal.has(tileKey(tile))).toBe(false);
        expect(tileKind(tile, MAZE.windowSize)).toBe("open");
      }
    }
  });

  it("keeps the rest in place when a Piece covers one", () => {
    const before = groundDecorations(7, MAZE);
    const covered = before[0];
    if (covered === undefined) throw new Error("expected a decoration");
    const after = groundDecorations(
      7,
      withWalls(MAZE, covered.tile.column, [covered.tile.row]),
    );
    expect(after).not.toContainEqual(covered);
    for (const decoration of after) expect(before).toContainEqual(decoration);
  });

  it("sits inside its own tile", () => {
    for (const { tile, x, y } of groundDecorations(7, MAZE)) {
      expect(Math.floor(x / TILE_SIZE)).toBe(tile.column);
      expect(Math.floor(y / TILE_SIZE)).toBe(tile.row);
    }
  });
});

describe("surroundPlants", () => {
  it("is the same for the same seed and Window size", () => {
    expect(surroundPlants(7, 2)).toEqual(surroundPlants(7, 2));
  });

  it("grows only outside the Board, around every side of it", () => {
    for (const windowSize of [-2, 0, 3]) {
      const frame = boardPixelFrame(windowSize);
      const plants = surroundPlants(7, windowSize);
      for (const { x, y } of plants) {
        const inside =
          x > 0 &&
          x < frame.width &&
          y > frame.top &&
          y < frame.top + frame.height;
        expect(inside).toBe(false);
      }
      expect(plants.some(({ y }) => y < frame.top)).toBe(true);
      expect(plants.some(({ y }) => y > frame.top + frame.height)).toBe(true);
      expect(plants.some(({ x }) => x < 0)).toBe(true);
      expect(plants.some(({ x }) => x > frame.width)).toBe(true);
      expect(new Set(plants.map(({ kind }) => kind))).toEqual(
        new Set(["tree", "bush"]),
      );
    }
  });
});
