import { describe, expect, it } from "vitest";
import { tileAtPoint } from "../../../src/adapters/input/board-pointer";

describe("tileAtPoint", () => {
  it("finds the tile a point is inside", () => {
    expect(tileAtPoint({ x: 0, y: 0 }, 64)).toEqual({ column: 0, row: 0 });
    expect(tileAtPoint({ x: 63.9, y: 64 }, 64)).toEqual({ column: 0, row: 1 });
    expect(tileAtPoint({ x: 1279, y: 895 }, 64)).toEqual({
      column: 19,
      row: 13,
    });
  });

  it("is null off the Board", () => {
    expect(tileAtPoint({ x: -1, y: 10 }, 64)).toBeNull();
    expect(tileAtPoint({ x: 1280, y: 10 }, 64)).toBeNull();
    expect(tileAtPoint({ x: 10, y: 896 }, 64)).toBeNull();
  });
});
