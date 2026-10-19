import { describe, expect, it } from "vitest";
import {
  STEPS_PER_SECOND,
  runBattle,
  startBattle,
  stepBattleTimes,
  type BattleSetup,
} from "../../src/battle/battle";
import type { BattleEvent } from "../../src/battle/events";
import {
  WATCH_SPEEDS,
  stepsDue,
  type WatchSpeed,
} from "../../src/battle/watch-clock";
import { createRng } from "../../src/rng/rng";
import {
  crateWalls,
  internGroups,
  mazeWith,
  setupOf,
  wallWithGap,
} from "./battle-setups";

const STEP_MS = 1000 / STEPS_PER_SECOND;

describe("stepsDue", () => {
  it("runs 60 steps per real second at 1x", () => {
    let carryMs = 0;
    let steps = 0;
    for (let frame = 0; frame < 60; frame++) {
      const due = stepsDue(carryMs, 1000 / 60, 1);
      carryMs = due.carryMs;
      steps += due.steps;
    }
    expect(steps).toBeGreaterThanOrEqual(59);
    expect(steps).toBeLessThanOrEqual(60);
  });

  it.each<WatchSpeed>([2, 4])("runs %ix as many steps at %ix", (speed) => {
    expect(stepsDue(0, 100, speed).steps).toBe(
      Math.floor((100 * speed) / STEP_MS),
    );
  });

  it("carries the part of a step left over into the next frame", () => {
    const first = stepsDue(0, STEP_MS * 0.6, 1);
    expect(first.steps).toBe(0);
    expect(stepsDue(first.carryMs, STEP_MS * 0.6, 1).steps).toBe(1);
  });

  it("does not try to catch up a long pause all at once", () => {
    const due = stepsDue(0, 60_000, 4);
    expect(due.steps).toBeLessThan(60 * STEPS_PER_SECOND);
    expect(due.carryMs).toBe(0);
  });
});

/** Plays a battle the way the page does: uneven frames, each worth the steps `stepsDue` gives. */
function watch(
  setup: BattleSetup,
  speed: WatchSpeed,
): { result: unknown; events: BattleEvent[]; frames: number } {
  const frameRng = createRng(99);
  let state = startBattle(setup);
  let carryMs = 0;
  let frames = 0;
  const events: BattleEvent[] = [];
  while (state.outcome === null) {
    frames++;
    const due = stepsDue(carryMs, 8 + frameRng() * 25, speed);
    carryMs = due.carryMs;
    const ran = stepBattleTimes(setup, state, due.steps);
    state = ran.state;
    events.push(...ran.events);
  }
  return { result: state, events, frames };
}

describe("Watch speed", () => {
  const setup = setupOf(
    mazeWith([
      ...crateWalls(wallWithGap(6, 12)),
      ...crateWalls(wallWithGap(12, 1)),
      { pieceId: "sniper-nest", tile: { column: 8, row: 6 } },
      { pieceId: "sniper-nest", tile: { column: 14, row: 7 } },
    ]),
    internGroups(1, 5, 9, 13),
    {},
    77,
  );
  const headless = runBattle(setup);

  it.each(WATCH_SPEEDS)("gives the same result at %ix", (speed) => {
    const watched = watch(setup, speed);
    expect(watched.result).toEqual(headless.state);
    expect(watched.events).toEqual(headless.events);
  });

  it("gets there in fewer real frames at a higher speed", () => {
    const frames = WATCH_SPEEDS.map((speed) => watch(setup, speed).frames);
    expect(frames[1]).toBeLessThan(frames[0] ?? 0);
    expect(frames[2]).toBeLessThan(frames[1] ?? 0);
  });
});
