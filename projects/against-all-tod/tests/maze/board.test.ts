import { describe, expect, it } from "vitest";
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  SPAWN_ZONE_COLUMNS,
  allTiles,
  goalTiles,
  isInSpawnZone,
  isOnBoard,
  spawnZoneTiles,
  tileKind,
} from "../../src/maze/board";

describe("the Board", () => {
  it("is 22 columns by 14 rows", () => {
    expect(BOARD_COLUMNS).toBe(22);
    expect(BOARD_ROWS).toBe(14);
    expect(allTiles(0)).toHaveLength(22 * 14);
  });

  it("has the Spawn zone down the whole of its 3 left columns", () => {
    expect(SPAWN_ZONE_COLUMNS).toBe(3);
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let column = 0; column < 3; column++) {
        expect(tileKind({ column, row }, 0)).toBe("spawn-zone");
        expect(isInSpawnZone({ column, row }, 0)).toBe(true);
      }
      expect(isInSpawnZone({ column: 3, row }, 0)).toBe(false);
    }
    expect(spawnZoneTiles(0)).toHaveLength(3 * 14);
  });

  it("is never in the Spawn zone off the Board", () => {
    expect(isInSpawnZone({ column: -1, row: 0 }, 0)).toBe(false);
    expect(isInSpawnZone({ column: 0, row: BOARD_ROWS }, 0)).toBe(false);
    expect(isInSpawnZone({ column: 0.5, row: 0 }, 0)).toBe(false);
  });

  it("has the Goal on the right edge, in the middle two rows", () => {
    const goal = allTiles(0).filter((tile) => tileKind(tile, 0) === "goal");
    expect(goal).toEqual([
      { column: 21, row: 6 },
      { column: 21, row: 7 },
    ]);
    expect(goalTiles()).toEqual(goal);
  });

  it("leaves the Maze its 19 columns, open everywhere else", () => {
    expect(tileKind({ column: 3, row: 0 }, 0)).toBe("open");
    expect(tileKind({ column: 21, row: 0 }, 0)).toBe("open");
    expect(tileKind({ column: 21, row: 13 }, 0)).toBe("open");
    const open = allTiles(0).filter((tile) => tileKind(tile, 0) === "open");
    expect(open).toHaveLength(19 * 14 - 2);
  });

  it("refuses tiles off the Board", () => {
    expect(() => tileKind({ column: 22, row: 0 }, 0)).toThrow(/off the Board/);
    expect(() => tileKind({ column: 0, row: -1 }, 0)).toThrow(/off the Board/);
  });
});

describe("the Board at another Window size", () => {
  it("gains an open lane along the top and bottom edges per step up", () => {
    expect(allTiles(1)).toHaveLength(22 * 16);
    expect(allTiles(2)).toHaveLength(22 * 18);
    for (const row of [-2, -1, 14, 15]) {
      expect(isOnBoard({ column: 10, row }, 2)).toBe(true);
      expect(tileKind({ column: 10, row }, 2)).toBe("open");
    }
    expect(isOnBoard({ column: 10, row: -2 }, 1)).toBe(false);
    expect(isOnBoard({ column: 10, row: 14 }, 0)).toBe(false);
  });

  it("widens the Spawn zone into the lanes", () => {
    expect(tileKind({ column: 0, row: -1 }, 1)).toBe("spawn-zone");
    expect(tileKind({ column: 2, row: 14 }, 1)).toBe("spawn-zone");
    expect(spawnZoneTiles(1)).toHaveLength(3 * 16);
  });

  it("keeps the Goal where it is", () => {
    for (const windowSize of [-2, 2]) {
      const goal = allTiles(windowSize).filter(
        (tile) => tileKind(tile, windowSize) === "goal",
      );
      expect(goal).toEqual(goalTiles());
    }
  });

  it("closes Spawn zone rows from the top and bottom per step down, leaving the Maze as it is", () => {
    expect(allTiles(-2)).toHaveLength(22 * 14);
    for (const row of [0, 1, 12, 13]) {
      expect(tileKind({ column: 1, row }, -2)).toBe("closed");
      expect(isInSpawnZone({ column: 1, row }, -2)).toBe(false);
      expect(tileKind({ column: 3, row }, -2)).toBe("open");
    }
    expect(tileKind({ column: 1, row: 1 }, -1)).toBe("spawn-zone");
    expect(spawnZoneTiles(-1)).toHaveLength(3 * 12);
    expect(spawnZoneTiles(-2)).toHaveLength(3 * 10);
  });
});
