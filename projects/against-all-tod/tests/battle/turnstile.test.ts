import { describe, expect, it } from "vitest";
import {
  STEPS_PER_SECOND,
  routeAt,
  startBattle,
  stepBattle,
  turnstilesTurned,
} from "../../src/battle/battle";
import { PIECES } from "../../src/catalog/pieces";
import { BOARD_ROWS, type Tile } from "../../src/maze/board";
import { checkPlacement, placePiece } from "../../src/maze/maze";
import { pathToGoal } from "../../src/maze/route";
import {
  crateWalls,
  groupAt,
  internGroups,
  mazeWith,
  setupOf,
} from "./battle-setups";

const TURN_STEPS =
  (PIECES.turnstile.turnIntervalSeconds ?? 0) * STEPS_PER_SECOND;

/** A wall down column 10, open on `gapRows`. */
function wallOpenOn(gapRows: readonly number[]): Tile[] {
  return Array.from({ length: BOARD_ROWS }, (_, row) => ({
    column: 10,
    row,
  })).filter((tile) => !gapRows.includes(tile.row));
}

describe("placing a Turnstile", () => {
  it("is refused when its turned arms would seal the Goal", () => {
    // Unturned it blocks only row 5 of the gap; turned it closes rows 4 to 6.
    const maze = mazeWith(crateWalls(wallOpenOn([4, 5, 6])));
    expect(checkPlacement(maze, { column: 10, row: 5 }, "turnstile")).toBe(
      "seals-goal",
    );
    expect(checkPlacement(maze, { column: 10, row: 5 }, "crate-wall")).toBe(
      null,
    );
  });

  it("is refused when its unturned arms would seal the Goal", () => {
    const maze = mazeWith(crateWalls(wallOpenOn([6])));
    expect(checkPlacement(maze, { column: 11, row: 6 }, "turnstile")).toBe(
      "seals-goal",
    );
  });

  it("is allowed when the Goal stays reachable in both positions", () => {
    const maze = mazeWith(crateWalls(wallOpenOn([3, 4, 5, 6, 7])));
    expect(placePiece(maze, { column: 10, row: 5 }, "turnstile").ok).toBe(true);
  });
});

describe("a Turnstile in battle", () => {
  const maze = mazeWith([
    ...crateWalls(wallOpenOn([3, 4, 5, 6, 7])),
    { pieceId: "turnstile", tile: { column: 10, row: 5 } },
  ]);

  it("turns every 5 seconds", () => {
    expect(turnstilesTurned(0)).toBe(false);
    expect(turnstilesTurned(TURN_STEPS - 1)).toBe(false);
    expect(turnstilesTurned(TURN_STEPS)).toBe(true);
    expect(turnstilesTurned(2 * TURN_STEPS)).toBe(false);
    expect(routeAt(maze, TURN_STEPS)).toBe(maze.turnedRoute);
  });

  it("flips the route Dudes take through the gap", () => {
    const start = { column: 0, row: 5 };
    const crossing = (route: typeof maze.route) =>
      pathToGoal(route, start).find((tile) => tile.column === 10)?.row;
    expect([4, 6]).toContain(crossing(maze.route));
    expect([3, 7]).toContain(crossing(maze.turnedRoute));
  });

  it("makes Dudes re-route when it turns", () => {
    // The whole Army charges at once: fast Streakers reach the Turnstile before it turns, Interns after.
    const setup = setupOf(
      maze,
      [...groupAt("streaker", 5, 2), ...internGroups(5)],
      {
        goalHealth: 1_000_000,
      },
    );
    const crossedRows = {
      unturned: new Set<number>(),
      turned: new Set<number>(),
    };
    let state = startBattle(setup);
    while (state.outcome === null) {
      state = stepBattle(setup, state);
      const rows = turnstilesTurned(state.step)
        ? crossedRows.turned
        : crossedRows.unturned;
      for (const dude of state.dudes) {
        if (Math.floor(dude.x) === 10) rows.add(Math.floor(dude.y));
      }
    }
    expect([...crossedRows.unturned].some((row) => [4, 6].includes(row))).toBe(
      true,
    );
    expect([...crossedRows.turned].some((row) => [3, 7].includes(row))).toBe(
      true,
    );
  });
});
