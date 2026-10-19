import { describe, expect, it } from "vitest";
import {
  startBattle,
  stepBattleTimes,
  STEPS_PER_SECOND,
  type BattleSetup,
  type BattleState,
} from "../../src/battle/battle";
import { newDude, type DudeState } from "../../src/battle/dudes";
import type { BattleEvent } from "../../src/battle/events";
import { DUDE_KINDS, type DudeKindId } from "../../src/catalog/dudes";
import { PIECES, type PieceId } from "../../src/catalog/pieces";
import { goldEarned } from "../../src/economy/economy";
import { distanceToGoal } from "../../src/maze/route";
import { internSquads, mazeWith, setupOf } from "./battle-setups";

const STURDY_GOAL = { goalHealth: 1_000_000 };
/** Row 6 runs straight from the Spawn zone into the Goal. */
const ROW = 6;

function dudeAt(id: number, kind: DudeKindId, x: number): DudeState {
  return { ...newDude(id, kind, { x: 0.5, y: ROW + 0.5 }), x };
}

function battleWith(setup: BattleSetup, dudes: DudeState[]): BattleState {
  return { ...startBattle(setup), dudes };
}

function setupWith(pieceId: PieceId, column: number, row = ROW): BattleSetup {
  return setupOf(
    mazeWith([{ pieceId, tile: { column, row } }]),
    [],
    STURDY_GOAL,
  );
}

function ofType<T extends BattleEvent["type"]>(
  events: readonly BattleEvent[],
  type: T,
): Extract<BattleEvent, { type: T }>[] {
  return events.filter(
    (event): event is Extract<BattleEvent, { type: T }> => event.type === type,
  );
}

const seconds = (count: number) => count * STEPS_PER_SECOND;

describe("the Tax Booth", () => {
  it("is walked over, and taxes each Dude once as it steps on", () => {
    const setup = setupWith("tax-booth", 5);
    expect(
      distanceToGoal(setup.maze.route, { column: 5, row: ROW }),
    ).not.toBeNull();
    const { events } = stepBattleTimes(
      setup,
      battleWith(setup, [dudeAt(0, "intern", 2.5), dudeAt(1, "intern", 1.5)]),
      seconds(5),
    );
    expect(ofType(events, "taxed").map(({ dudeId }) => dudeId)).toEqual([0, 1]);
  });
});

describe("the Grinder", () => {
  const setup = setupWith("grinder", 5);

  it("kills a small Dude outright, then lets the next one through while jammed", () => {
    const { state, events } = stepBattleTimes(
      setup,
      battleWith(setup, [dudeAt(0, "intern", 4.5), dudeAt(1, "streaker", 3.5)]),
      seconds(2),
    );
    const kills = ofType(events, "kill");
    expect(kills.map(({ dudeId, pieceId }) => [dudeId, pieceId])).toEqual([
      [0, "grinder"],
    ]);
    expect(state.dudes.map(({ id }) => id)).toEqual([1]);
  });

  it("works again once the jam is over", () => {
    const jam =
      PIECES.grinder.trap?.kind === "grinder"
        ? PIECES.grinder.trap.jamSeconds
        : 0;
    const farSetup = setupWith("grinder", 12);
    const { events } = stepBattleTimes(
      farSetup,
      battleWith(farSetup, [
        dudeAt(0, "intern", 11.5),
        // Reaches the Grinder well after the jam ends.
        dudeAt(1, "intern", 11.5 - DUDE_KINDS.intern.speed * (jam + 1)),
      ]),
      seconds(jam + 3),
    );
    expect(ofType(events, "kill").map(({ dudeId }) => dudeId)).toEqual([0, 1]);
  });

  it("only hurts a bigger Dude", () => {
    const { state, events } = stepBattleTimes(
      setup,
      battleWith(setup, [dudeAt(0, "ram-crew", 4.5)]),
      seconds(1),
    );
    expect(ofType(events, "kill")).toEqual([]);
    expect(state.dudes[0]?.health).toBeLessThan(DUDE_KINDS["ram-crew"].health);
  });
});

describe("the Bouncer", () => {
  // Beside the row, so Dudes walk past it.
  const setup = setupWith("bouncer", 6, ROW - 1);

  it("throws a Dude back to the spot it started the battle on", () => {
    const start = { x: 2.2, y: 9.3 };
    const thrown = { ...newDude(0, "intern", start), x: 6.5, y: ROW - 0.5 };
    const { state } = stepBattleTimes(setup, battleWith(setup, [thrown]), 1);
    // Thrown back, then one step's walk from there.
    const back = state.dudes[0];
    expect(back?.start).toEqual(start);
    expect(back?.x).toBeCloseTo(start.x, 1);
    expect(back?.y).toBeCloseTo(start.y, 1);
  });

  it("throws the first Dude it touches back to the Spawn zone, then waits", () => {
    const { state } = stepBattleTimes(
      setup,
      battleWith(setup, [dudeAt(0, "intern", 4.5), dudeAt(1, "intern", 4)]),
      seconds(1.5),
    );
    const [first, second] = [...state.dudes].sort((a, b) => a.id - b.id);
    expect(first?.x).toBeLessThan(3);
    // On the cooldown, the second Dude walks on past.
    expect(second?.x).toBeGreaterThan(6);
  });
});

describe("the Decoy Goal", () => {
  it("draws Dudes until it breaks; those that hit it vanish and earn nothing", () => {
    const setup = setupOf(
      mazeWith([{ pieceId: "decoy-goal", tile: { column: 10, row: 2 } }]),
      internSquads(ROW),
      STURDY_GOAL,
    );
    const { state, events } = stepBattleTimes(
      setup,
      startBattle(setup),
      seconds(60),
    );
    const hits = ofType(events, "decoy-hit");
    const toBreak = Math.ceil(
      PIECES["decoy-goal"].health / DUDE_KINDS.intern.goalDamage,
    );
    // The Army arrives together, so more than one Dude may hit it in the step it breaks.
    const breakStep = hits.at(-1)?.step;
    const beforeBreak = hits.filter(({ step }) => step !== breakStep);
    expect(beforeBreak.length).toBeLessThan(toBreak);
    expect(hits.length).toBeGreaterThanOrEqual(toBreak);
    expect(state.maze.pieces.size).toBe(0);
    const reached = ofType(events, "reach-goal");
    expect(reached).toHaveLength(DUDE_KINDS.intern.squadSize - hits.length);
    const firstReach = reached[0]?.step ?? 0;
    expect(hits.every(({ step }) => step < firstReach)).toBe(true);
    expect(
      goldEarned(hits, {
        winner: "attack",
        goalHealth: 0,
        survivors: [],
        mutations: [],
      }),
    ).toEqual({ defense: 0, attack: 0 });
  });
});
