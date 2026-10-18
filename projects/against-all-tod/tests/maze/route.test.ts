import { describe, expect, it } from "vitest";
import type { Tile } from "../../src/maze/board";
import {
  computeRoute,
  pathToGoal,
  reachesGoal,
  routeStep,
} from "../../src/maze/route";

const everywhere = () => true;

describe("computeRoute", () => {
  it("cuts toward the Goal rather than running along the edge when steps tie", () => {
    const path = pathToGoal(computeRoute(everywhere), { column: 0, row: 0 });
    // An L would cross the whole top row to the far edge before turning down.
    const firstDown = path.findIndex((tile) => tile.row > 0);
    expect(firstDown).toBeGreaterThan(0);
    expect(path[firstDown]?.column).toBeLessThan(19);
  });

  it("only walks tiles the predicate allows", () => {
    const blocked = (tile: Tile) => !(tile.column === 18 && tile.row === 6);
    const route = computeRoute(blocked);
    expect(reachesGoal(route, { column: 18, row: 6 })).toBe(false);
    expect(routeStep(route, { column: 17, row: 6 })).not.toBe("right");
  });

  it("reaches nothing when no tile is walkable", () => {
    const route = computeRoute(() => false);
    expect(reachesGoal(route, { column: 0, row: 6 })).toBe(false);
    expect(routeStep(route, { column: 19, row: 6 })).toBe("at-goal");
  });
});
