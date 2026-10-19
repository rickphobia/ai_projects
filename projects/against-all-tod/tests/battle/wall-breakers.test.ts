import { describe, expect, it } from "vitest";
import {
  runBattle,
  startBattle,
  stepBattle,
  type BattleSetup,
  type BattleState,
} from "../../src/battle/battle";
import { newDude, tileUnder, type DudeState } from "../../src/battle/dudes";
import type { BattleEvent, PieceDestroyedEvent } from "../../src/battle/events";
import { carrierSpeedFactor, strike } from "../../src/battle/wall-breakers";
import { DUDE_KINDS, type DudeKindId } from "../../src/catalog/dudes";
import { PIECES } from "../../src/catalog/pieces";
import { tileKey } from "../../src/maze/board";
import { emptyMaze, pieceAt } from "../../src/maze/maze";
import { distanceToGoal } from "../../src/maze/route";
import {
  crateWalls,
  internSquads,
  mazeWith,
  setupOf,
  wallWithGap,
} from "./battle-setups";

const STURDY_GOAL = { goalHealth: 1_000_000 };
/** A wall down column 8 with its only gap at the bottom, so the way round is long. */
const LONG_WAY_ROUND = crateWalls(wallWithGap(8, 13));

function dudeAt(id: number, kind: DudeKindId, x: number, y: number): DudeState {
  return { ...newDude(id, kind, { x: 0.5, y: 0.5 }), x, y };
}

/** The battle at its start, with `dudes` already on the Board and no one waiting. */
function battleWith(setup: BattleSetup, dudes: DudeState[]): BattleState {
  return { ...startBattle(setup), dudes };
}

function destroyedIn(events: readonly BattleEvent[]): PieceDestroyedEvent[] {
  return events.filter(
    (event): event is PieceDestroyedEvent => event.type === "piece-destroyed",
  );
}

describe("ordinary Dudes", () => {
  it("never damage a Piece", () => {
    const setup = setupOf(
      mazeWith(LONG_WAY_ROUND),
      internSquads(3, 6, 10),
      STURDY_GOAL,
    );
    const { state, events } = runBattle(setup);
    expect(destroyedIn(events)).toEqual([]);
    expect(state.maze).toBe(setup.maze);
    expect(state.pieceHealth.size).toBe(0);
  });
});

describe("the Termite", () => {
  const setup = setupOf(
    mazeWith(LONG_WAY_ROUND),
    [{ dudeKind: "termite", tile: { column: 0, row: 6 } }],
    STURDY_GOAL,
  );

  it("chews through the wall in its way over time, rather than walking the long way round", () => {
    let state = startBattle(setup);
    const healthSeen = new Set<number>();
    let destroyed: PieceDestroyedEvent | undefined;
    while (state.outcome === null && destroyed === undefined) {
      state = stepBattle(setup, state);
      for (const health of state.pieceHealth.values()) healthSeen.add(health);
      destroyed = destroyedIn(state.events)[0];
      // Termites head for the wall, never down toward the gap.
      for (const dude of state.dudes) expect(dude.y).toBeLessThan(8);
    }
    if (destroyed === undefined) throw new Error("the wall never fell");

    expect(destroyed).toMatchObject({
      pieceId: "crate-wall",
      dudeKind: "termite",
    });
    expect(destroyed.pieceTile.column).toBe(8);
    // Many small bites, not one: the wall wore down through many health levels first.
    expect(healthSeen.size).toBeGreaterThan(10);
    expect(pieceAt(state.maze, destroyed.pieceTile)).toBeUndefined();
  });
});

describe("other Dudes after a wall breaks", () => {
  it("re-route through the hole", () => {
    const setup = setupOf(
      mazeWith(LONG_WAY_ROUND),
      [
        { dudeKind: "termite", tile: { column: 0, row: 6 } },
        { dudeKind: "intern", tile: { column: 0, row: 5 } },
      ],
      STURDY_GOAL,
    );
    let state = startBattle(setup);
    let hole: string | null = null;
    let internWentThrough = false;
    while (state.outcome === null && !internWentThrough) {
      state = stepBattle(setup, state);
      const destroyed = destroyedIn(state.events)[0];
      if (destroyed !== undefined && hole === null) {
        hole = tileKey(destroyed.pieceTile);
        const spawn = { column: 0, row: 5 };
        expect(
          distanceToGoal(state.maze.route, spawn) ?? Infinity,
        ).toBeLessThan(distanceToGoal(setup.maze.route, spawn) ?? 0);
      }
      internWentThrough = state.dudes.some(
        (dude) => dude.kind === "intern" && tileKey(tileUnder(dude)) === hole,
      );
    }
    expect(hole).not.toBeNull();
    expect(internWentThrough).toBe(true);
  });
});

describe("the Ram Crew", () => {
  const nest = { column: 8, row: 6 };
  const maze = mazeWith([
    ...LONG_WAY_ROUND.filter(({ tile }) => tileKey(tile) !== tileKey(nest)),
    { pieceId: "sniper-nest", tile: nest },
  ]);
  const setup = setupOf(
    maze,
    [{ dudeKind: "ram-crew", tile: { column: 0, row: 6 } }],
    STURDY_GOAL,
  );

  it("smashes a tower in one hit, and the tower stops shooting", () => {
    const ram = dudeAt(0, "ram-crew", 7.5, 6.5);
    const after = stepBattle(setup, battleWith(setup, [ram]));
    expect(destroyedIn(after.events)).toEqual([
      {
        type: "piece-destroyed",
        step: 1,
        pieceId: "sniper-nest",
        pieceTile: nest,
        dudeId: 0,
        dudeKind: "ram-crew",
      },
    ]);
    expect(PIECES["sniper-nest"].health).toBeLessThan(
      DUDE_KINDS["ram-crew"].wallBreaker?.attack === "ram"
        ? DUDE_KINDS["ram-crew"].wallBreaker.damage
        : 0,
    );
    expect(after.towers).toEqual([]);
    expect(pieceAt(after.maze, nest)).toBeUndefined();
  });

  it("hits once per cooldown", () => {
    const stats = DUDE_KINDS["ram-crew"].wallBreaker;
    if (stats?.attack !== "ram") throw new Error("the Ram Crew must ram");
    const ram = dudeAt(0, "ram-crew", 7.5, 6.5);
    const first = strike(ram, 1, 60);
    expect(first.damage).toBe(stats.damage);
    if (first.dude === null) throw new Error("the Ram Crew is not spent");
    const cooldownSteps = stats.cooldownSeconds * 60;
    expect(strike(first.dude, cooldownSteps, 60).damage).toBe(0);
    expect(strike(first.dude, 1 + cooldownSteps, 60).damage).toBe(stats.damage);
  });

  it("slows as its 4 carriers die", () => {
    const kind = DUDE_KINDS["ram-crew"];
    const full = dudeAt(0, "ram-crew", 2.5, 3.5);
    const twoDown = {
      ...dudeAt(1, "ram-crew", 2.5, 9.5),
      health: kind.health / 2,
    };
    const lastOne = { ...full, health: 1 };
    expect(carrierSpeedFactor(full)).toBe(1);
    expect(carrierSpeedFactor(twoDown)).toBe(0.5);
    expect(carrierSpeedFactor(lastOne)).toBe(0.25);

    const open = setupOf(emptyMaze(), [], STURDY_GOAL);
    const after = stepBattle(open, battleWith(open, [full, twoDown]));
    const moved = (id: number, from: DudeState) => {
      const dude = after.dudes.find((each) => each.id === id);
      if (dude === undefined) throw new Error(`Dude ${String(id)} vanished`);
      return Math.hypot(dude.x - from.x, dude.y - from.y);
    };
    expect(moved(1, twoDown)).toBeCloseTo(moved(0, full) / 2);
  });
});

describe("the Sapper", () => {
  const lone = { column: 3, row: 3 };
  const setup = setupOf(
    mazeWith([...LONG_WAY_ROUND, { pieceId: "crate-wall", tile: lone }]),
    [{ dudeKind: "sapper", tile: { column: 0, row: 3 } }],
    STURDY_GOAL,
  );

  it("runs to the nearest wall and blows up himself and the wall", () => {
    const { state, events } = runBattle(setup);
    const destroyed = destroyedIn(events);
    const squadSize = DUDE_KINDS.sapper.squadSize;

    // The first goes for the lone crate near the Spawn line, not the wall in the Sapper's way.
    expect(destroyed[0]).toMatchObject({
      pieceTile: lone,
      pieceId: "crate-wall",
      dudeKind: "sapper",
    });
    // Each Sapper takes exactly one wall with him, whatever its health.
    expect(destroyed).toHaveLength(squadSize);
    expect(new Set(destroyed.map((event) => event.dudeId)).size).toBe(
      squadSize,
    );
    expect(events.some((event) => event.type === "kill")).toBe(false);
    expect(events.some((event) => event.type === "reach-goal")).toBe(false);
    expect(state.outcome?.reason).toBe("army-gone");
    expect(state.maze.pieces.size).toBe(setup.maze.pieces.size - squadSize);
  });

  it("walks to the Goal when there is no wall left", () => {
    const open = setupOf(
      emptyMaze(),
      [{ dudeKind: "sapper", tile: { column: 0, row: 3 } }],
      STURDY_GOAL,
    );
    const reached = runBattle(open).events.filter(
      (event) => event.type === "reach-goal",
    );
    expect(reached).toHaveLength(DUDE_KINDS.sapper.squadSize);
  });
});

describe("a battle where Pieces fall", () => {
  it("gives the same result from the same setup", () => {
    const setup = setupOf(
      mazeWith([
        ...LONG_WAY_ROUND,
        { pieceId: "sniper-nest", tile: { column: 10, row: 4 } },
        { pieceId: "turnstile", tile: { column: 13, row: 9 } },
      ]),
      [
        { dudeKind: "termite", tile: { column: 0, row: 6 } },
        { dudeKind: "ram-crew", tile: { column: 0, row: 2 } },
        { dudeKind: "sapper", tile: { column: 0, row: 11 } },
        ...internSquads(4, 8),
      ],
      undefined,
      7,
    );
    const first = runBattle(setup);
    const again = runBattle(setup);
    expect(destroyedIn(first.events).length).toBeGreaterThan(0);
    expect(again.events).toEqual(first.events);
    expect(again.state).toEqual(first.state);
  });
});
