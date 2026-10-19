import { describe, expect, it } from "vitest";
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  SPAWN_ZONE_COLUMNS,
  allTiles,
  isInSpawnZone,
  spawnZoneTiles,
  tileKind,
} from "../../src/maze/board";

describe("the Board", () => {
  it("is 22 columns by 14 rows", () => {
    expect(BOARD_COLUMNS).toBe(22);
    expect(BOARD_ROWS).toBe(14);
    expect(allTiles()).toHaveLength(22 * 14);
  });

  it("has the Spawn zone down the whole of its 3 left columns", () => {
    expect(SPAWN_ZONE_COLUMNS).toBe(3);
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let column = 0; column < 3; column++) {
        expect(tileKind({ column, row })).toBe("spawn-zone");
        expect(isInSpawnZone({ column, row })).toBe(true);
      }
      expect(isInSpawnZone({ column: 3, row })).toBe(false);
    }
    expect(spawnZoneTiles()).toHaveLength(3 * 14);
  });

  it("is never in the Spawn zone off the Board", () => {
    expect(isInSpawnZone({ column: -1, row: 0 })).toBe(false);
    expect(isInSpawnZone({ column: 0, row: BOARD_ROWS })).toBe(false);
    expect(isInSpawnZone({ column: 0.5, row: 0 })).toBe(false);
  });

  it("has the Goal on the right edge, in the middle two rows", () => {
    const goalTiles = allTiles().filter((tile) => tileKind(tile) === "goal");
    expect(goalTiles).toEqual([
      { column: 21, row: 6 },
      { column: 21, row: 7 },
    ]);
  });

  it("leaves the Maze its 19 columns, open everywhere else", () => {
    expect(tileKind({ column: 3, row: 0 })).toBe("open");
    expect(tileKind({ column: 21, row: 0 })).toBe("open");
    expect(tileKind({ column: 21, row: 13 })).toBe("open");
    const open = allTiles().filter((tile) => tileKind(tile) === "open");
    expect(open).toHaveLength(19 * 14 - 2);
  });

  it("refuses tiles off the Board", () => {
    expect(() => tileKind({ column: 22, row: 0 })).toThrow(/off the Board/);
    expect(() => tileKind({ column: 0, row: -1 })).toThrow(/off the Board/);
  });
});
