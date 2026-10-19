import { describe, expect, it } from "vitest";
import {
  startBattle,
  stepBattle,
  stepBattleTimes,
  STEPS_PER_SECOND,
  type BattleSetup,
  type BattleState,
} from "../../src/battle/battle";
import { earthquake } from "../../src/battle/curses";
import { newDude } from "../../src/battle/dudes";
import type { BattleEvent } from "../../src/battle/events";
import { CURSE_RULES, type CurseId } from "../../src/catalog/curses";
import { PIECES } from "../../src/catalog/pieces";
import { spawnZoneTiles, tileKey } from "../../src/maze/board";
import { placedPieces, type Maze } from "../../src/maze/maze";
import { reachesGoal } from "../../src/maze/route";
import {
  crateWalls,
  groupAt,
  mazeWith,
  setupOf,
  wallWithGap,
} from "./battle-setups";

const STURDY_GOAL = { goalHealth: 1_000_000 };
/** Row 6 runs straight from the Spawn zone into the Goal. */
const ROW = 6;

const seconds = (count: number) => count * STEPS_PER_SECOND;

function cursed(curse: CurseId | null, setup: BattleSetup): BattleSetup {
  return { ...setup, curse };
}

function ofType<T extends BattleEvent["type"]>(
  events: readonly BattleEvent[],
  type: T,
): Extract<BattleEvent, { type: T }>[] {
  return events.filter(
    (event): event is Extract<BattleEvent, { type: T }> => event.type === type,
  );
}

function run(setup: BattleSetup, steps: number, start?: BattleState) {
  return stepBattleTimes(setup, start ?? startBattle(setup), steps);
}

describe("Rust", () => {
  const sniper = PIECES["sniper-nest"].tower;
  if (sniper === null) throw new Error("the Sniper Nest must shoot");
  const setup = setupOf(
    mazeWith([{ pieceId: "sniper-nest", tile: { column: 3, row: ROW + 1 } }]),
    groupAt("intern", ROW, 2),
    STURDY_GOAL,
  );

  it("makes towers wait 20% longer between shots", () => {
    const shotSteps = (curse: CurseId | null) =>
      ofType(run(cursed(curse, setup), seconds(3)).events, "shot").map(
        ({ step }) => step,
      );
    const gap = (steps: number[]) => (steps[1] ?? 0) - (steps[0] ?? 0);
    const interval = sniper.fireIntervalSeconds * STEPS_PER_SECOND;
    expect(gap(shotSteps(null))).toBe(Math.round(interval));
    expect(gap(shotSteps("rust"))).toBe(
      Math.round(interval * CURSE_RULES.rustReloadMultiplier),
    );
  });
});

describe("Power Cut", () => {
  const setup = setupOf(
    mazeWith([
      { pieceId: "siren", tile: { column: 5, row: ROW + 1 } },
      { pieceId: "lighthouse", tile: { column: 8, row: ROW + 1 } },
    ]),
    groupAt("intern", ROW),
    STURDY_GOAL,
  );
  /** Whether any Dude was ever stunned or hurt in the first 10 seconds. */
  const touched = (curse: CurseId | null) => {
    const cursedSetup = cursed(curse, setup);
    let state = startBattle(cursedSetup);
    let stunned = false;
    let hurt = false;
    for (let step = 0; step < seconds(10); step++) {
      state = stepBattle(cursedSetup, state);
      stunned ||= state.dudes.some(
        (dude) => (dude.stunnedUntilStep ?? 0) > state.step,
      );
      hurt ||=
        ofType(state.events, "kill").length > 0 ||
        state.dudes.some((dude) => dude.health < dude.fullHealth);
    }
    return { stunned, hurt };
  };

  it("switches Lighthouses and Sirens off", () => {
    expect(touched(null)).toEqual({ stunned: true, hurt: true });
    expect(startBattle(cursed("power-cut", setup)).effectPieces).toEqual([]);
    expect(touched("power-cut")).toEqual({ stunned: false, hurt: false });
  });
});

describe("Earthquake", () => {
  const maze = mazeWith(crateWalls(wallWithGap(10, ROW)));
  const setup = setupOf(maze, groupAt("intern", ROW), STURDY_GOAL);

  function moved(before: Maze, after: Maze) {
    const keys = (of: Maze) =>
      new Set(placedPieces(of).map(({ tile }) => tileKey(tile)));
    const was = keys(before);
    const now = keys(after);
    return {
      left: [...was].filter((key) => !now.has(key)),
      arrived: [...now].filter((key) => !was.has(key)),
    };
  }

  it("moves one Piece one tile for the battle, leaving the Board as it was", () => {
    const state = startBattle(cursed("earthquake", setup));
    const quake = earthquake(maze, setup.seed);
    if (quake === null) throw new Error("some Piece must be able to move");
    expect(moved(maze, state.maze)).toEqual({
      left: [tileKey(quake.from)],
      arrived: [tileKey(quake.to)],
    });
    expect(
      Math.abs(quake.from.column - quake.to.column) +
        Math.abs(quake.from.row - quake.to.row),
    ).toBe(1);
    expect(placedPieces(setup.maze)).toEqual(placedPieces(maze));
  });

  it("never seals the Goal, whatever the seed", () => {
    for (let seed = 0; seed < 50; seed++) {
      const quake = earthquake(maze, seed);
      if (quake === null) throw new Error("some Piece must be able to move");
      for (const route of [quake.maze.route, quake.maze.turnedRoute]) {
        expect(
          spawnZoneTiles(0).every((tile) => reachesGoal(route, tile)),
        ).toBe(true);
      }
    }
  });

  it("leaves a Maze with nowhere to move as it is", () => {
    expect(earthquake(mazeWith([]), 1)).toBeNull();
  });
});

describe("Audit", () => {
  const setup = setupOf(
    mazeWith([{ pieceId: "tax-booth", tile: { column: 5, row: ROW } }]),
    groupAt("intern", ROW, 0, 4),
    STURDY_GOAL,
  );

  it("makes Tax Booths pay nothing", () => {
    const taxed = (curse: CurseId | null) =>
      ofType(run(cursed(curse, setup), seconds(10)).events, "taxed").length;
    expect(taxed(null)).toBe(4);
    expect(taxed("audit")).toBe(0);
  });
});

describe("Traffic Jam", () => {
  const setup = cursed(
    "traffic-jam",
    setupOf(mazeWith([]), groupAt("intern", ROW), STURDY_GOAL),
  );
  const gapSteps = CURSE_RULES.trafficJamGapSeconds * STEPS_PER_SECOND;

  it("sets the Army off one Dude at a time, in paint order", () => {
    const start = startBattle(setup);
    const { state } = run(setup, Math.round(5 * gapSteps) + 1);
    const setOff = state.dudes
      .filter((dude) => {
        const was = start.dudes.find(({ id }) => id === dude.id);
        return was !== undefined && dude.x !== was.x;
      })
      .map(({ id }) => id);
    expect(setOff).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("never holds back Dudes born in the battle", () => {
    const start = startBattle(setup);
    const half = newDude(500, "intern", { x: 1.5, y: ROW + 0.5 });
    const { state } = run(setup, 2, { ...start, dudes: [half] });
    expect(state.dudes[0]?.x).toBeGreaterThan(half.x);
  });
});

describe("Mud", () => {
  const setup = setupOf(
    mazeWith([]),
    groupAt("intern", ROW, 0, 1),
    STURDY_GOAL,
  );

  it("slows Dudes by 20%", () => {
    const walked = (curse: CurseId | null) => {
      const start = startBattle(setup);
      const { state } = run(cursed(curse, setup), seconds(1));
      return (state.dudes[0]?.x ?? 0) - (start.dudes[0]?.x ?? 0);
    };
    expect(walked("mud") / walked(null)).toBeCloseTo(
      CURSE_RULES.mudSpeedMultiplier,
    );
  });
});

describe("Stage Fright", () => {
  const army = [...groupAt("hype-man", 3, 0, 1), ...groupAt("intern", 3, 0)];
  const internX = (curse: CurseId | null, withHype = true) => {
    const setup = cursed(
      curse,
      setupOf(mazeWith([]), withHype ? army : army.slice(1), STURDY_GOAL),
    );
    const { state } = run(setup, 60);
    return state.dudes.find((dude) => dude.kind === "intern")?.x ?? 0;
  };

  it("stops Hype Men boosting anyone", () => {
    expect(internX(null)).toBeGreaterThan(internX(null, false));
    expect(internX("stage-fright")).toBeCloseTo(internX(null, false));
  });
});

describe("Union Break", () => {
  // A wall with its only gap at the top: Termites would rather chew through than walk round.
  const setup = setupOf(
    mazeWith(crateWalls(wallWithGap(8, 0))),
    groupAt("termite", ROW),
    STURDY_GOAL,
  );
  const chewed = (curse: CurseId | null) => {
    const { state, events } = run(cursed(curse, setup), seconds(30));
    return state.pieceHealth.size + ofType(events, "piece-destroyed").length;
  };

  it("stops Wall-breakers damaging Pieces", () => {
    expect(chewed(null)).toBeGreaterThan(0);
    expect(chewed("union-break")).toBe(0);
  });

  it("sends them round the walls with everyone else", () => {
    const { state, events } = run(cursed("union-break", setup), seconds(30));
    expect(state.breakerRoutes).toBeNull();
    expect(ofType(events, "reach-goal").length).toBeGreaterThan(0);
  });
});
