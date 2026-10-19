import { describe, expect, it } from "vitest";
import {
  runBattle,
  startBattle,
  stepBattle,
  stepBattleTimes,
  STEPS_PER_SECOND,
  type BattleSetup,
  type BattleState,
} from "../../src/battle/battle";
import {
  destroyedForGood,
  hrTile,
  landlordDude,
} from "../../src/battle/bosses";
import { newDude, type DudeState } from "../../src/battle/dudes";
import type { BattleEvent, PieceDestroyedEvent } from "../../src/battle/events";
import { BOSS_RULES, type BossId } from "../../src/catalog/bosses";
import { DUDE_KINDS, type DudeKindId } from "../../src/catalog/dudes";
import { goldBreakdown } from "../../src/economy/economy";
import type { Tile } from "../../src/maze/board";
import { emptyMaze, pieceAt, type Maze } from "../../src/maze/maze";
import { distanceToGoal } from "../../src/maze/route";
import { crateWalls, groupAt, mazeWith, setupOf } from "./battle-setups";

const STURDY_GOAL = { goalHealth: 1_000_000 };

function withBoss(setup: BattleSetup, boss: BossId): BattleSetup {
  return { ...setup, boss };
}

function dudeAt(id: number, kind: DudeKindId, x: number, y: number): DudeState {
  return { ...newDude(id, kind, { x: 0.5, y: 0.5 + id }), x, y };
}

/** The battle at its start, with `dudes` already on the Board. */
function battleWith(setup: BattleSetup, dudes: DudeState[]): BattleState {
  return { ...startBattle(setup), dudes };
}

function landlordOf(state: BattleState): DudeState | undefined {
  return state.dudes.find((dude) => dude.kind === "landlord");
}

function evictionsIn(events: readonly BattleEvent[]): PieceDestroyedEvent[] {
  return events.filter(
    (event): event is PieceDestroyedEvent =>
      event.type === "piece-destroyed" && event.dudeKind === "landlord",
  );
}

describe("The Landlord", () => {
  const army = groupAt("intern", 3);

  it("joins the Army only on his Boss Round, with his huge health", () => {
    const setup = setupOf(emptyMaze(), army);
    expect(landlordOf(startBattle(setup))).toBeUndefined();
    const landlord = landlordOf(startBattle(withBoss(setup, "landlord")));
    expect(landlord).toMatchObject({
      id: army.length,
      x: BOSS_RULES.landlordStart.x,
      y: BOSS_RULES.landlordStart.y,
      health: DUDE_KINDS.landlord.health,
    });
    const armyHealths = Object.values(DUDE_KINDS).flatMap(({ id, health }) =>
      id === "landlord" ? [] : [health],
    );
    expect(DUDE_KINDS.landlord.health).toBeGreaterThan(
      5 * Math.max(...armyHealths),
    );
  });

  it("evicts the Piece nearest him each time he has walked another 10 tiles", () => {
    // Walls far off his straight walk to the Goal, so they don't change his route.
    const near: Tile = { column: 12, row: 2 };
    const far: Tile = { column: 5, row: 12 };
    const setup = withBoss(
      setupOf(mazeWith(crateWalls([near, far])), [], STURDY_GOAL),
      "landlord",
    );
    let state = startBattle(setup);
    const every = BOSS_RULES.landlordEvictEveryTiles;
    const evictions: { walked: number; event: PieceDestroyedEvent }[] = [];
    let walkedBefore = 0;
    while (state.outcome === null) {
      state = stepBattle(setup, state);
      const walked = landlordOf(state)?.walked ?? walkedBefore;
      for (const event of evictionsIn(state.events)) {
        // Evicted in the step his walk passed the next multiple of 10 tiles.
        expect(Math.floor(walked / every)).toBe(
          Math.floor(walkedBefore / every) + 1,
        );
        evictions.push({ walked, event });
      }
      walkedBefore = walked;
    }
    expect(Math.floor(walkedBefore / every)).toBe(1);
    expect(evictions.map(({ event }) => event.pieceTile)).toEqual([near]);
    expect(pieceAt(state.maze, near)).toBeUndefined();
    expect(pieceAt(state.maze, far)).toBe("crate-wall");
  });

  it("evicts again every 10 tiles, never sealing the Goal", () => {
    // A long way round: down column 8 with the gap at the bottom, so he walks well past 20 tiles.
    const walls = crateWalls(
      Array.from({ length: 13 }, (_, row) => ({ column: 8, row })),
    );
    const setup = withBoss(
      setupOf(mazeWith(walls), [], STURDY_GOAL),
      "landlord",
    );
    const { state, events } = runBattle(setup);
    const evicted = evictionsIn(events);
    expect(evicted.length).toBeGreaterThanOrEqual(2);
    expect(state.maze.pieces.size).toBe(walls.length - evicted.length);
    expect(distanceToGoal(state.maze.route, { column: 1, row: 7 })).not.toBe(
      null,
    );
  });

  it("evicts for his battle only: the Board keeps what Wall-breakers broke, not his evictions", () => {
    const broken: PieceDestroyedEvent = {
      type: "piece-destroyed",
      step: 1,
      pieceId: "crate-wall",
      pieceTile: { column: 9, row: 3 },
      dudeId: 0,
      dudeKind: "termite",
    };
    const evicted: PieceDestroyedEvent = {
      ...broken,
      pieceTile: { column: 12, row: 2 },
      dudeId: 1,
      dudeKind: "landlord",
    };
    expect(destroyedForGood([broken, evicted])).toEqual([broken.pieceTile]);
  });

  it("evicts for nobody's gold", () => {
    const setup = withBoss(
      setupOf(mazeWith(crateWalls([{ column: 12, row: 2 }])), [], STURDY_GOAL),
      "landlord",
    );
    const { events } = runBattle(setup);
    expect(evictionsIn(events)).toHaveLength(1);
    const gold = goldBreakdown(events, {
      winner: "defense",
      goalHealth: 0,
      survivors: [],
      mutations: [],
    });
    expect(gold.attack.piecesDestroyed).toBe(0);
  });

  it("isn't fooled by a Decoy Goal and doesn't split under the Army's Mutations", () => {
    const decoy: Tile = { column: 4, row: 7 };
    const setup = withBoss(
      setupOf(
        mazeWith([
          { pieceId: "decoy-goal", tile: decoy },
          { pieceId: "sniper-nest", tile: { column: 6, row: 4 } },
        ]),
        [],
        STURDY_GOAL,
        1,
        ["split", "ghost-mode"],
      ),
      "landlord",
    );
    const weak = { ...landlordDude(0), health: 1, x: 5.5, y: 4.5 };
    const { state } = stepBattleTimes(
      setup,
      battleWith(setup, [weak]),
      STEPS_PER_SECOND,
    );
    expect(state.dudes).toEqual([]);
    expect(state.ghosts).toEqual([]);
    expect(pieceAt(state.maze, decoy)).toBe("decoy-goal");
  });
});

describe("The HR Department", () => {
  /** A Maze with a wall, so the free tile nearest the Goal is worth checking. */
  const maze: Maze = mazeWith(
    crateWalls([
      { column: 20, row: 6 },
      { column: 20, row: 7 },
    ]),
  );
  const setup = withBoss(setupOf(maze, [], STURDY_GOAL), "hr-department");
  const at = hrTile(maze);
  if (at === null) throw new Error("no tile for the HR Department");
  const centre = { x: at.column + 0.5, y: at.row + 0.5 };

  it("stands in the Maze for its Boss Round only, on a free tile without changing the route", () => {
    expect(pieceAt(maze, at)).toBeUndefined();
    expect(distanceToGoal(maze.route, at)).toBe(1);
    const battleMaze = startBattle(setup).maze;
    expect(pieceAt(battleMaze, at)).toBe("hr-department");
    expect(pieceAt(startBattle({ ...setup, boss: null }).maze, at)).toBe(
      undefined,
    );
    expect(battleMaze.route).toEqual(maze.route);
  });

  it("sends a Wall-breaker in range back to where it stood, and leaves other Dudes alone", () => {
    const termite = dudeAt(0, "termite", centre.x - 1, centre.y);
    const intern = dudeAt(1, "intern", centre.x - 1, centre.y + 0.5);
    const after = stepBattle(setup, battleWith(setup, [termite, intern]));
    const [sent, passed] = after.dudes;
    // Back where it stood, then one step's walk on.
    expect(sent?.x).toBeLessThan(termite.start.x + 0.1);
    expect(sent?.y).toBeCloseTo(termite.start.y, 1);
    expect(passed?.x).toBeGreaterThan(termite.start.x + 5);
  });

  it("sends back one Wall-breaker per interval, the one nearest it first", () => {
    // Stunned for the whole test, so only the HR Department moves them.
    const stunned = { stunnedUntilStep: 10_000 };
    const nearer = {
      ...dudeAt(0, "termite", centre.x - 1, centre.y),
      ...stunned,
    };
    const further = {
      ...dudeAt(1, "termite", centre.x - 2, centre.y),
      ...stunned,
    };
    const first = stepBattle(setup, battleWith(setup, [further, nearer]));
    const byId = (state: BattleState, id: number) =>
      state.dudes.find((dude) => dude.id === id);
    const isBack = (state: BattleState, id: number) =>
      (byId(state, id)?.x ?? Infinity) < 5;
    expect(isBack(first, 0)).toBe(true);
    expect(isBack(first, 1)).toBe(false);
    const interval = BOSS_RULES.hrIntervalSeconds * STEPS_PER_SECOND;
    const waiting = stepBattleTimes(setup, first, interval - 2).state;
    expect(isBack(waiting, 1)).toBe(false);
    const again = stepBattleTimes(setup, waiting, 2).state;
    expect(isBack(again, 1)).toBe(true);
  });
});
