import { describe, expect, it } from "vitest";
import { STEPS_PER_SECOND, runBattle } from "../../src/battle/battle";
import { newDude, tileUnder, type DudeState } from "../../src/battle/dudes";
import { fireTowers, pickTarget } from "../../src/battle/towers";
import { DUDE_KINDS } from "../../src/catalog/dudes";
import { PIECES } from "../../src/catalog/pieces";
import { BOARD_COLUMNS, BOARD_ROWS } from "../../src/maze/board";
import { emptyMaze } from "../../src/maze/maze";
import { distanceToGoal } from "../../src/maze/route";
import { createRng } from "../../src/rng/rng";
import { internGroups, mazeWith, setupOf } from "./battle-setups";

const SNIPER = PIECES["sniper-nest"];
const SNIPER_STATS = SNIPER.tower;
if (SNIPER_STATS === null) throw new Error("the Sniper Nest must shoot");

describe("the Sniper Nest's choice of target", () => {
  it("shoots the biggest Dude, even when a smaller one is closer to the Goal", () => {
    expect(
      pickTarget([
        { id: 1, size: 1, distanceToGoal: 2 },
        { id: 2, size: 3, distanceToGoal: 9 },
        { id: 3, size: 2, distanceToGoal: 1 },
      ]),
    ).toBe(2);
  });

  it("shoots the one closest to the Goal among the biggest", () => {
    expect(
      pickTarget([
        { id: 1, size: 2, distanceToGoal: 5 },
        { id: 2, size: 2, distanceToGoal: 3 },
        { id: 3, size: 1, distanceToGoal: 0 },
      ]),
    ).toBe(2);
  });

  it("shoots the Dude that entered first when all else is equal", () => {
    expect(
      pickTarget([
        { id: 7, size: 1, distanceToGoal: 4 },
        { id: 4, size: 1, distanceToGoal: 4 },
      ]),
    ).toBe(4);
  });

  it("has no target when no one is in range", () => {
    expect(pickTarget([])).toBeNull();
  });
});

describe("a Sniper Nest in battle", () => {
  const nestTile = { column: 9, row: 3 };
  const setup = setupOf(
    mazeWith([{ pieceId: "sniper-nest", tile: nestTile }]),
    internGroups(3),
    { goalHealth: 1_000_000 },
  );
  const { events } = runBattle(setup);
  const shots = events.filter((event) => event.type === "shot");

  it("only shoots Dudes in range", () => {
    expect(shots.length).toBeGreaterThan(0);
    for (const shot of shots) {
      const dx = shot.at.x - (nestTile.column + 0.5);
      const dy = shot.at.y - (nestTile.row + 0.5);
      expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(SNIPER_STATS.range);
    }
  });

  it("waits its fire interval between shots", () => {
    const interval = Math.round(
      SNIPER_STATS.fireIntervalSeconds * STEPS_PER_SECOND,
    );
    for (let index = 1; index < shots.length; index++) {
      const gap = (shots[index]?.step ?? 0) - (shots[index - 1]?.step ?? 0);
      expect(gap).toBeGreaterThanOrEqual(interval);
    }
  });

  it("kills a Dude once its shots add up to the Dude's health", () => {
    const shotsToKill = Math.ceil(
      DUDE_KINDS.intern.health / SNIPER_STATS.damage,
    );
    const kills = events.filter((event) => event.type === "kill");
    expect(kills.length).toBeGreaterThan(0);
    for (const kill of kills) {
      expect(kill.pieceTile).toEqual(nestTile);
      expect(shots.filter((shot) => shot.dudeId === kill.dudeId)).toHaveLength(
        shotsToKill,
      );
    }
  });
});

describe("a Sniper Nest among many Dudes", () => {
  const route = emptyMaze().route;
  const range = SNIPER_STATS.range;

  /** Dudes scattered anywhere off the Spawn line and the Goal column. */
  function scatter(count: number, seed: number): DudeState[] {
    const random = createRng(seed);
    return Array.from({ length: count }, (_, id) => ({
      ...newDude(id, "intern", { x: 0.5, y: 0.5 }),
      x: 1 + random() * (BOARD_COLUMNS - 2),
      y: random() * BOARD_ROWS,
    }));
  }

  /** The target found by weighing every Dude on the Board. */
  function targetByCheckingEveryone(
    nest: { column: number; row: number },
    dudes: readonly DudeState[],
  ): number | null {
    const inRange = dudes.filter(
      (dude) =>
        Math.hypot(dude.x - (nest.column + 0.5), dude.y - (nest.row + 0.5)) <=
        range,
    );
    return pickTarget(
      inRange.map((dude) => ({
        id: dude.id,
        size: DUDE_KINDS[dude.kind].size,
        distanceToGoal: distanceToGoal(route, tileUnder(dude)) ?? Infinity,
      })),
    );
  }

  function shotAt(
    nest: { column: number; row: number },
    dudes: readonly DudeState[],
  ): number | null {
    const tower = {
      pieceId: "sniper-nest" as const,
      tile: nest,
      cooldownSteps: 0,
      aimedAt: null,
    };
    const { events } = fireTowers([tower], dudes, route, 1, STEPS_PER_SECOND);
    const shot = events.find((event) => event.type === "shot");
    return shot?.dudeId ?? null;
  }

  it("picks the same target as weighing every Dude, in a crowd of 500", () => {
    const nest = { column: 9, row: 6 };
    const crowd = scatter(500, 7);
    expect(shotAt(nest, crowd)).toBe(targetByCheckingEveryone(nest, crowd));
  });

  it("picks the same target as weighing every Dude, wherever the few in range stand", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const nest = {
        column: 1 + (seed % (BOARD_COLUMNS - 2)),
        row: seed % BOARD_ROWS,
      };
      const few = scatter(6, seed);
      expect(shotAt(nest, few)).toBe(targetByCheckingEveryone(nest, few));
    }
  });
});
