import { describe, expect, it } from "vitest";
import {
  ArmySetupError,
  STEPS_PER_SECOND,
  runBattle,
  startBattle,
  stepBattle,
  stepBattleTimes,
} from "../../src/battle/battle";
import { DUDE_KINDS } from "../../src/catalog/dudes";
import { SPAWN_ZONE_COLUMNS, tileKey, type Tile } from "../../src/maze/board";
import { tileUnder } from "../../src/battle/dudes";
import { emptyMaze } from "../../src/maze/maze";
import { pathToGoal } from "../../src/maze/route";
import {
  crateWalls,
  internSquads,
  mazeWith,
  squadAt,
  setupOf,
  wallWithGap,
} from "./battle-setups";

const INTERN = DUDE_KINDS.intern;

/** Rules that let every Intern of a few Squads reach the Goal without breaking it. */
const STURDY_GOAL = { goalHealth: 1_000_000 };

describe("Dudes walking the route", () => {
  it("walks each Intern tile by tile along the shared route, around the walls", () => {
    const maze = mazeWith(
      crateWalls([...wallWithGap(5, 12), ...wallWithGap(10, 1)]),
    );
    const setup = setupOf(maze, internSquads(3), STURDY_GOAL);
    const tilesWalked = new Map<number, Tile[]>();
    let state = startBattle(setup);
    while (state.outcome === null) {
      state = stepBattle(setup, state);
      for (const dude of state.dudes) {
        const tile = { column: Math.floor(dude.x), row: Math.floor(dude.y) };
        const walked = tilesWalked.get(dude.id) ?? [];
        const last = walked.at(-1);
        if (last === undefined || tileKey(last) !== tileKey(tile))
          walked.push(tile);
        tilesWalked.set(dude.id, walked);
      }
    }

    const route = pathToGoal(maze.route, { column: 0, row: 3 });
    expect(tilesWalked.size).toBe(INTERN.squadSize);
    for (const walked of tilesWalked.values()) {
      expect(walked).toEqual(route);
    }
  });

  it("puts the whole Army on the Board at step 0, each Squad spread over its own tile", () => {
    const army = [squadAt("intern", 3, 0), squadAt("termite", 9, 2)];
    const state = startBattle(setupOf(emptyMaze(), army));
    expect(state.dudes).toHaveLength(
      DUDE_KINDS.intern.squadSize + DUDE_KINDS.termite.squadSize,
    );
    for (const { dudeKind, tile } of army) {
      const squad = state.dudes.filter((dude) => dude.kind === dudeKind);
      expect(
        squad.every((dude) => tileKey(tileUnder(dude)) === tileKey(tile)),
      ).toBe(true);
      expect(
        new Set(squad.map((dude) => `${String(dude.x)},${String(dude.y)}`))
          .size,
      ).toBe(squad.length);
      expect(
        squad.every(
          (dude) => dude.start.x === dude.x && dude.start.y === dude.y,
        ),
      ).toBe(true);
    }
  });

  it("starts every Dude walking in the first step", () => {
    const setup = setupOf(emptyMaze(), internSquads(3, 10));
    const start = startBattle(setup);
    const afterOneStep = stepBattle(setup, start);
    expect(afterOneStep.dudes).toHaveLength(2 * INTERN.squadSize);
    for (const dude of afterOneStep.dudes) {
      expect(dude.x).toBeGreaterThan(dude.start.x);
    }
  });

  it.each([0, 1, 2])(
    "brings Interns from Spawn zone column %i through a Maze to the Goal",
    (column) => {
      const maze = mazeWith(
        crateWalls([...wallWithGap(5, 12), ...wallWithGap(10, 1)]),
      );
      const army = [0, 6, 13].map((row) => squadAt("intern", row, column));
      const { events } = runBattle(setupOf(maze, army, STURDY_GOAL));
      expect(
        events.filter((event) => event.type === "reach-goal"),
      ).toHaveLength(army.length * INTERN.squadSize);
    },
  );

  it("refuses a Squad that is not in the Spawn zone", () => {
    expect(() => startBattle(setupOf(emptyMaze(), internSquads(99)))).toThrow(
      ArmySetupError,
    );
    expect(() =>
      startBattle(
        setupOf(emptyMaze(), [squadAt("intern", 3, SPAWN_ZONE_COLUMNS)]),
      ),
    ).toThrow(ArmySetupError);
  });
});

describe("the Goal", () => {
  it("takes each kind's damage from every Dude that reaches it, and the Dude vanishes", () => {
    const setup = setupOf(emptyMaze(), internSquads(2, 11), STURDY_GOAL);
    const { state, events } = runBattle(setup);

    const reached = events.filter((event) => event.type === "reach-goal");
    expect(reached).toHaveLength(2 * INTERN.squadSize);
    expect(reached.every((event) => event.damage === INTERN.goalDamage)).toBe(
      true,
    );
    expect(state.goalHealth).toBe(
      STURDY_GOAL.goalHealth - 2 * INTERN.squadSize * INTERN.goalDamage,
    );
    expect(state.dudes).toEqual([]);
  });
});

describe("the end of a battle", () => {
  it("is an attack win as soon as the Goal reaches zero", () => {
    const goalHealth = INTERN.goalDamage * 3;
    const { state, events } = runBattle(
      setupOf(emptyMaze(), internSquads(6), { goalHealth }),
    );
    expect(state.outcome).toMatchObject({
      winner: "attack",
      reason: "goal-destroyed",
    });
    expect(state.goalHealth).toBe(0);
    expect(events.filter((event) => event.type === "reach-goal")).toHaveLength(
      3,
    );
    expect(state.dudes.length).toBeGreaterThan(0);
  });

  it("is a defense win when no Dudes are left and the Goal stands", () => {
    const { state } = runBattle(
      setupOf(emptyMaze(), internSquads(6), STURDY_GOAL),
    );
    expect(state.outcome).toMatchObject({
      winner: "defense",
      reason: "army-gone",
    });
  });

  it("is a defense win when time runs out", () => {
    const timeLimitSeconds = 2;
    const { state } = runBattle(
      setupOf(emptyMaze(), internSquads(6), {
        ...STURDY_GOAL,
        timeLimitSeconds,
      }),
    );
    expect(state.outcome).toEqual({
      winner: "defense",
      reason: "time-up",
      step: timeLimitSeconds * STEPS_PER_SECOND,
    });
    expect(state.dudes.length).toBeGreaterThan(0);
  });

  it("does not change once it has ended", () => {
    const setup = setupOf(emptyMaze(), internSquads(6), {
      timeLimitSeconds: 1,
    });
    const { state } = runBattle(setup);
    expect(stepBattle(setup, state)).toBe(state);
  });
});

describe("events", () => {
  it("accounts for every Dude exactly once, as a kill or as reaching the Goal", () => {
    const maze = mazeWith([
      ...crateWalls(wallWithGap(8, 1)),
      { pieceId: "sniper-nest", tile: { column: 6, row: 4 } },
      { pieceId: "sniper-nest", tile: { column: 10, row: 4 } },
    ]);
    const { events } = runBattle(
      setupOf(maze, internSquads(3, 9), STURDY_GOAL),
    );
    const ends = events.filter(
      (event) => event.type === "kill" || event.type === "reach-goal",
    );
    const ids = ends.map((event) => event.dudeId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(2 * INTERN.squadSize);
    expect(ends.some((event) => event.type === "kill")).toBe(true);
  });

  it("gives each step's events only with that step", () => {
    const setup = setupOf(emptyMaze(), internSquads(6), STURDY_GOAL);
    const { events } = runBattle(setup);
    const first = events[0];
    if (first === undefined) throw new Error("no events");
    const before = stepBattleTimes(setup, startBattle(setup), first.step - 1);
    expect(before.events).toEqual([]);
    expect(stepBattle(setup, before.state).events).toContainEqual(first);
  });
});

describe("replaying a battle", () => {
  const maze = mazeWith([
    ...crateWalls(wallWithGap(7, 11)),
    { pieceId: "sniper-nest", tile: { column: 9, row: 8 } },
  ]);

  it("gives the same result from the same seed and inputs", () => {
    const setup = setupOf(maze, internSquads(2, 7, 12), {}, 1234);
    expect(runBattle(setup)).toEqual(runBattle(setup));
  });

  it("spreads Dudes differently with a different seed", () => {
    const dudesAfterOneSecond = (seed: number) => {
      const setup = setupOf(maze, internSquads(2), {}, seed);
      return stepBattleTimes(setup, startBattle(setup), STEPS_PER_SECOND).state
        .dudes;
    };
    expect(dudesAfterOneSecond(1)).not.toEqual(dudesAfterOneSecond(2));
  });
});
