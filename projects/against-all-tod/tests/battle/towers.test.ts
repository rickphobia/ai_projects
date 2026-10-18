import { describe, expect, it } from "vitest";
import { STEPS_PER_SECOND, runBattle } from "../../src/battle/battle";
import { pickTarget } from "../../src/battle/towers";
import { DUDE_KINDS } from "../../src/catalog/dudes";
import { PIECES } from "../../src/catalog/pieces";
import { internSquads, mazeWith, setupOf } from "./battle-setups";

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
    internSquads(3),
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
