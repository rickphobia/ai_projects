import { describe, expect, it } from "vitest";
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  allTiles,
  tileKind,
} from "../../src/maze/board";

describe("the Board", () => {
  it("is 20 columns by 14 rows", () => {
    expect(BOARD_COLUMNS).toBe(20);
    expect(BOARD_ROWS).toBe(14);
    expect(allTiles()).toHaveLength(20 * 14);
  });

  it("has the Spawn line down the whole left column", () => {
    for (let row = 0; row < BOARD_ROWS; row++) {
      expect(tileKind({ column: 0, row })).toBe("spawn-line");
    }
  });

  it("has the Goal on the right edge, in the middle two rows", () => {
    const goalTiles = allTiles().filter((tile) => tileKind(tile) === "goal");
    expect(goalTiles).toEqual([
      { column: 19, row: 6 },
      { column: 19, row: 7 },
    ]);
  });

  it("is open everywhere else", () => {
    expect(tileKind({ column: 1, row: 0 })).toBe("open");
    expect(tileKind({ column: 19, row: 0 })).toBe("open");
    expect(tileKind({ column: 19, row: 13 })).toBe("open");
    const open = allTiles().filter((tile) => tileKind(tile) === "open");
    expect(open).toHaveLength(20 * 14 - 14 - 2);
  });

  it("refuses tiles off the Board", () => {
    expect(() => tileKind({ column: 20, row: 0 })).toThrow(/off the Board/);
    expect(() => tileKind({ column: 0, row: -1 })).toThrow(/off the Board/);
  });
});
