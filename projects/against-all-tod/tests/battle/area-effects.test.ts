import { describe, expect, it } from "vitest";
import { litTiles, sirenRange } from "../../src/battle/area-effects";
import {
  STEPS_PER_SECOND,
  runBattle,
  startBattle,
  stepBattleTimes,
} from "../../src/battle/battle";
import type { KillEvent } from "../../src/battle/events";
import { PIECES } from "../../src/catalog/pieces";
import { tileKey } from "../../src/maze/board";
import { internSquads, mazeWith, setupOf } from "./battle-setups";

const SIREN_STATS = PIECES.siren.stun;
if (SIREN_STATS === null) throw new Error("the Siren must stun");
const BEAM_STATS = PIECES.lighthouse.beam;
if (BEAM_STATS === null) throw new Error("the Lighthouse must have a beam");

describe("a Lighthouse in battle", () => {
  const tile = { column: 9, row: 3 };
  const setup = setupOf(
    mazeWith([{ pieceId: "lighthouse", tile }]),
    internSquads(3),
    { goalHealth: 1_000_000 },
  );
  const { events } = runBattle(setup);
  const kills = events.filter(
    (event): event is KillEvent =>
      event.type === "kill" && event.pieceId === "lighthouse",
  );

  it("kills Dudes its beam sweeps over", () => {
    expect(kills.length).toBeGreaterThan(0);
  });

  it("only kills Dudes within the beam's range", () => {
    for (const kill of kills) {
      const dx = kill.at.x - (tile.column + 0.5);
      const dy = kill.at.y - (tile.row + 0.5);
      expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(BEAM_STATS.range);
    }
  });

  it("lights the tiles around it for other towers", () => {
    const lit = litTiles(setup.maze);
    expect(lit.has(tileKey(tile))).toBe(true);
    expect(lit.has(tileKey({ column: 11, row: 3 }))).toBe(true);
    expect(lit.has(tileKey({ column: 9, row: 6 }))).toBe(false);
  });
});

describe("a Siren in battle", () => {
  const tile = { column: 3, row: 2 };
  const setup = setupOf(
    mazeWith([{ pieceId: "siren", tile }]),
    internSquads(3),
  );
  const pulseStep = Math.round(SIREN_STATS.intervalSeconds * STEPS_PER_SECOND);
  const atPulse = stepBattleTimes(setup, startBattle(setup), pulseStep).state;
  const range = sirenRange(SIREN_STATS, 0);
  const inRange = (dude: { x: number; y: number }) =>
    Math.hypot(dude.x - (tile.column + 0.5), dude.y - (tile.row + 0.5)) <=
    range;

  it("stuns every Dude in range when its pulse is due, and no one else", () => {
    expect(atPulse.dudes.some(inRange)).toBe(true);
    for (const dude of atPulse.dudes) {
      expect((dude.stunnedUntilStep ?? 0) > pulseStep).toBe(inRange(dude));
    }
  });

  it("holds stunned Dudes still until the stun wears off", () => {
    const stunSteps = Math.round(SIREN_STATS.stunSeconds * STEPS_PER_SECOND);
    const later = stepBattleTimes(setup, atPulse, stunSteps - 1).state;
    for (const before of atPulse.dudes.filter(inRange)) {
      const after = later.dudes.find((dude) => dude.id === before.id);
      expect(after).toMatchObject({ x: before.x, y: before.y });
    }
  });
});

describe("the Siren's range and the Volume level", () => {
  it("is the catalog range at neutral Volume", () => {
    expect(sirenRange(SIREN_STATS, 0)).toBe(SIREN_STATS.range);
  });

  it("grows with Volume up and shrinks with Volume down", () => {
    expect(sirenRange(SIREN_STATS, 2)).toBeGreaterThan(SIREN_STATS.range);
    expect(sirenRange(SIREN_STATS, -2)).toBeLessThan(SIREN_STATS.range);
  });

  it("reaches further Dudes in a battle at loud Volume", () => {
    const tile = { column: 3, row: 2 };
    const army = internSquads(3);
    const stunnedAt = (volume: number) => {
      const setup = {
        ...setupOf(mazeWith([{ pieceId: "siren", tile }]), army),
        volume,
      };
      const steps = Math.round(SIREN_STATS.intervalSeconds * STEPS_PER_SECOND);
      const { state } = stepBattleTimes(setup, startBattle(setup), steps);
      return state.dudes.filter((dude) => dude.stunnedUntilStep !== undefined)
        .length;
    };
    expect(stunnedAt(2)).toBeGreaterThan(stunnedAt(0));
  });
});
