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
import { DudeHits } from "../../src/battle/damage";
import { newDude, type DudeState } from "../../src/battle/dudes";
import type { BattleEvent } from "../../src/battle/events";
import { afterDeaths } from "../../src/battle/mutations";
import { fireTowers, towersOf } from "../../src/battle/towers";
import { DUDE_KINDS } from "../../src/catalog/dudes";
import { MUTATION_RULES, type MutationId } from "../../src/catalog/mutations";
import { PIECES } from "../../src/catalog/pieces";
import { goldBreakdown } from "../../src/economy/economy";
import { BOARD_COLUMNS } from "../../src/maze/board";
import { battleSetupOf, newRun } from "../../src/run/run";
import { internSquads, mazeWith, setupOf } from "./battle-setups";

const STURDY_GOAL = { goalHealth: 1_000_000 };
/** Row 6 runs straight from the Spawn line into the Goal. */
const ROW = 6;
const INTERN = DUDE_KINDS.intern;
const SNIPER = PIECES["sniper-nest"].tower;
if (SNIPER === null) throw new Error("the Sniper Nest must shoot");
const NEST = {
  pieceId: "sniper-nest" as const,
  pieceTile: { column: 0, row: 0 },
};

function withMutations(
  mutations: readonly MutationId[],
  setup: BattleSetup,
): BattleSetup {
  return { ...setup, mutations };
}

function internAt(id: number, x: number, extra: Partial<DudeState> = {}) {
  return { ...newDude(id, "intern", ROW, 0), x, ...extra };
}

function battleWith(setup: BattleSetup, dudes: DudeState[]): BattleState {
  return { ...startBattle(setup), dudes, waiting: [], nextDudeId: 100 };
}

function ofType<T extends BattleEvent["type"]>(
  events: readonly BattleEvent[],
  type: T,
): Extract<BattleEvent, { type: T }>[] {
  return events.filter(
    (event): event is Extract<BattleEvent, { type: T }> => event.type === type,
  );
}

/** Steps until the first kill and returns the state just after it. */
function untilFirstKill(setup: BattleSetup): BattleState {
  let state = startBattle(setup);
  while (state.outcome === null) {
    state = stepBattle(setup, state);
    if (ofType(state.events, "kill").length > 0) return state;
  }
  throw new Error("nobody died");
}

describe("Split", () => {
  const nestAt = { column: 4, row: ROW + 1 };
  const setup = withMutations(
    ["split"],
    setupOf(
      mazeWith([{ pieceId: "sniper-nest", tile: nestAt }]),
      internSquads(ROW),
      STURDY_GOAL,
    ),
  );

  it("turns a dying Dude into two halves where it died", () => {
    const state = untilFirstKill(setup);
    const [kill] = ofType(state.events, "kill");
    const halves = state.dudes.filter((dude) => dude.half);
    expect(halves).toHaveLength(2);
    for (const half of halves) {
      expect(half.kind).toBe("intern");
      expect(half.health).toBe(INTERN.health * MUTATION_RULES.splitHealthShare);
      expect(half.x).toBe(kill?.at.x);
      expect(half.id).toBeGreaterThanOrEqual(INTERN.squadSize);
    }
  });

  it("doesn't split a half again", () => {
    const half = { ...internAt(5, 3.5), half: true as const };
    const kill = {
      type: "kill" as const,
      step: 1,
      ...NEST,
      dudeId: half.id,
      dudeKind: half.kind,
      at: { x: half.x, y: half.y },
    };
    const after = afterDeaths(
      [kill],
      [half],
      ["split"],
      1,
      STEPS_PER_SECOND,
      1,
      10,
    );
    expect(after.halves).toEqual([]);
  });

  it("gets more Dudes to the Goal than without it", () => {
    const reached = (mutations: MutationId[]) =>
      ofType(runBattle(withMutations(mutations, setup)).events, "reach-goal")
        .length;
    expect(reached(["split"])).toBeGreaterThan(reached([]));
  });
});

describe("Giant", () => {
  const setup = withMutations(
    ["giant"],
    setupOf(mazeWith([]), internSquads(2, 9), STURDY_GOAL),
  );

  it("makes one Dude per Squad giant: 5× health", () => {
    const giants = startBattle(setup).waiting.filter(({ dude }) => dude.giant);
    expect(giants).toHaveLength(2);
    for (const { dude } of giants) {
      expect(dude.health).toBe(
        INTERN.health * MUTATION_RULES.giantHealthMultiplier,
      );
    }
    const others = startBattle(setup).waiting.filter(({ dude }) => !dude.giant);
    expect(others.every(({ dude }) => dude.health === INTERN.health)).toBe(
      true,
    );
  });

  it("walks the giant at half speed", () => {
    const { state } = stepBattleTimes(
      setup,
      startBattle(setup),
      STEPS_PER_SECOND,
    );
    const giant = state.dudes.find((dude) => dude.giant);
    expect(giant?.x).toBeCloseTo(
      0.5 + INTERN.speed * MUTATION_RULES.giantSpeedMultiplier,
      5,
    );
  });
});

describe("Explosive Shields", () => {
  // Two tiles from the Spawn line, so the first shot lands inside the burst range.
  const nestAt = { column: 2, row: ROW + 1 };
  const plain = setupOf(
    mazeWith([{ pieceId: "sniper-nest", tile: nestAt }]),
    internSquads(ROW),
    STURDY_GOAL,
  );
  const shielded = withMutations(["explosive-shields"], plain);

  it("gives every Dude a small shield that soaks a hit first", () => {
    const state = startBattle(shielded);
    expect(
      state.waiting.every(
        ({ dude }) => dude.smallShield === MUTATION_RULES.smallShieldHealth,
      ),
    ).toBe(true);
    const intern = internAt(0, 1.5, {
      smallShield: MUTATION_RULES.smallShieldHealth,
    });
    const volley = fireTowers(
      towersOf(shielded.maze),
      [intern],
      shielded.maze.route,
      1,
      STEPS_PER_SECOND,
    );
    expect(volley.dudes[0]?.health).toBe(
      INTERN.health - (SNIPER.damage - MUTATION_RULES.smallShieldHealth),
    );
    expect(ofType(volley.events, "shield-burst")).toHaveLength(1);
  });

  it("stuns the towers near a breaking shield for 1 second", () => {
    const shotSteps = (setup: BattleSetup) =>
      ofType(
        stepBattleTimes(setup, startBattle(setup), 3 * STEPS_PER_SECOND).events,
        "shot",
      ).map(({ step }) => step);
    const [firstPlain, secondPlain] = shotSteps(plain);
    const [first, second] = shotSteps(shielded);
    if (firstPlain === undefined || secondPlain === undefined) {
      throw new Error("the nest should fire twice");
    }
    expect(first).toBe(firstPlain);
    expect(secondPlain - firstPlain).toBe(
      Math.round(SNIPER.fireIntervalSeconds * STEPS_PER_SECOND),
    );
    expect((second ?? 0) - (first ?? 0)).toBeGreaterThanOrEqual(
      MUTATION_RULES.shieldBurstStunSeconds * STEPS_PER_SECOND,
    );
  });
});

describe("Conga Line", () => {
  const setup = withMutations(
    ["conga-line"],
    setupOf(mazeWith([]), internSquads(3, 10), STURDY_GOAL),
  );

  it("walks each Squad in single file", () => {
    const { waiting } = startBattle(setup);
    expect(waiting.every(({ dude }) => dude.lane === 0)).toBe(true);
    expect(new Set(waiting.map(({ dude }) => dude.congaSquad))).toEqual(
      new Set([0, 1]),
    );
  });

  it("shares a hit across the Squad's living members", () => {
    const squad = [0, 1, 2, 3].map((id) =>
      internAt(id, 1.5 + id * 0.3, { congaSquad: 0 }),
    );
    const outsider = internAt(4, 1.5);
    const events: BattleEvent[] = [];
    const hits = new DudeHits([...squad, outsider], 1, events);
    hits.hurt(squad[0] ?? outsider, 40, NEST);
    const after = hits.applyTo([...squad, outsider]);
    expect(after.slice(0, 4).map((dude) => dude.health)).toEqual([
      20, 20, 20, 20,
    ]);
    expect(after[4]?.health).toBe(INTERN.health);
    expect(events).toEqual([]);
  });

  it("wastes focused fire: a shot that kills an Intern alone kills nobody", () => {
    const squad = [0, 1].map((id) =>
      internAt(id, 1.5 + id * 0.3, { congaSquad: 0 }),
    );
    const maze = mazeWith([
      { pieceId: "sniper-nest", tile: { column: 2, row: ROW + 1 } },
    ]);
    const volley = fireTowers(
      towersOf(maze),
      squad,
      maze.route,
      1,
      STEPS_PER_SECOND,
    );
    expect(SNIPER.damage).toBeGreaterThanOrEqual(INTERN.health);
    expect(ofType(volley.events, "kill")).toEqual([]);
    expect(volley.dudes.map((dude) => dude.health)).toEqual([
      INTERN.health - SNIPER.damage / 2,
      INTERN.health - SNIPER.damage / 2,
    ]);
  });
  it("doesn't share a Grinder hit with a Squadmate that has just reached the Goal", () => {
    const grinderAt = { column: 5, row: ROW };
    const setup = withMutations(
      ["conga-line"],
      setupOf(
        mazeWith([{ pieceId: "grinder", tile: grinderAt }]),
        [],
        STURDY_GOAL,
      ),
    );
    const bro = (id: number, x: number, health: number) => ({
      ...newDude(id, "shield-bro", ROW, 0),
      x,
      health,
      shield: 0,
      congaSquad: 0,
    });
    const atGoal = bro(0, BOARD_COLUMNS - 0.5, 10);
    const ontoGrinder = bro(
      1,
      grinderAt.column - 0.01,
      DUDE_KINDS["shield-bro"].health,
    );
    const state = stepBattle(setup, battleWith(setup, [atGoal, ontoGrinder]));
    expect(
      ofType(state.events, "reach-goal").map(({ dudeId }) => dudeId),
    ).toEqual([0]);
    expect(ofType(state.events, "kill")).toEqual([]);
    const grinder = PIECES.grinder.trap;
    if (grinder?.kind !== "grinder")
      throw new Error("the Grinder must be a grinder trap");
    expect(state.dudes.map((dude) => dude.health)).toEqual([
      DUDE_KINDS["shield-bro"].health - grinder.damage,
    ]);
  });
});

describe("Ghost Mode", () => {
  const nearGoal = BOARD_COLUMNS - 3;
  const nestAt = { column: nearGoal, row: ROW + 1 };
  const setup = withMutations(
    ["ghost-mode"],
    setupOf(
      mazeWith([{ pieceId: "sniper-nest", tile: nestAt }]),
      [],
      STURDY_GOAL,
    ),
  );

  it("keeps a Dude killed near the Goal walking; it still damages the Goal and pays", () => {
    const doomed = internAt(0, nearGoal - 0.5, { health: 1 });
    const { state, events } = stepBattleTimes(
      setup,
      battleWith(setup, [doomed]),
      3 * STEPS_PER_SECOND,
    );
    expect(ofType(events, "kill")).toHaveLength(1);
    const reached = ofType(events, "reach-goal");
    expect(reached.map(({ dudeId }) => dudeId)).toEqual([0]);
    expect(state.goalHealth).toBe(STURDY_GOAL.goalHealth - INTERN.goalDamage);
    const gold = goldBreakdown(events, {
      winner: "defense",
      goalHealth: state.goalHealth,
      survivors: [],
      mutations: setup.mutations,
    });
    expect(gold.attack.reachedGoal).toBeGreaterThan(0);
  });

  it("can't be shot, and fades after 3 seconds", () => {
    const farFromGoal = withMutations(
      ["ghost-mode"],
      setupOf(
        mazeWith([
          { pieceId: "sniper-nest", tile: { column: 3, row: ROW + 1 } },
        ]),
        [],
        STURDY_GOAL,
      ),
    );
    const doomed = internAt(0, 2.5, { health: 1 });
    let state = battleWith(farFromGoal, [doomed]);
    const shots: number[] = [];
    let ghostSince: number | null = null;
    while (state.outcome === null) {
      state = stepBattle(farFromGoal, state);
      shots.push(...ofType(state.events, "shot").map(({ step }) => step));
      if (ghostSince === null && state.ghosts.length > 0)
        ghostSince = state.step;
    }
    expect(shots).toHaveLength(1);
    expect(ghostSince).not.toBeNull();
    expect(state.outcome.reason).toBe("army-gone");
    expect(state.step - (ghostSince ?? 0)).toBe(
      MUTATION_RULES.ghostSeconds * STEPS_PER_SECOND,
    );
  });
});

describe("Gold Teeth", () => {
  it("doubles the Attack gold for Dudes reaching the Goal", () => {
    const setup = setupOf(mazeWith([]), internSquads(ROW), STURDY_GOAL);
    const { events } = runBattle(setup);
    const reachedGold = (mutations: MutationId[]) =>
      goldBreakdown(events, {
        winner: "defense",
        goalHealth: 0,
        survivors: [],
        mutations,
      }).attack.reachedGoal;
    expect(reachedGold([])).toBeGreaterThan(0);
    expect(reachedGold(["gold-teeth"])).toBe(
      reachedGold([]) * MUTATION_RULES.goldTeethMultiplier,
    );
  });
});

describe("Mutations together", () => {
  it("go into every battle of the Run, all at once", () => {
    const run = { ...newRun(7), mutations: ["giant", "split"] as MutationId[] };
    expect(battleSetupOf(run).mutations).toEqual(["giant", "split"]);
  });

  it("replay the same with every Mutation on", () => {
    const all: MutationId[] = [
      "split",
      "giant",
      "explosive-shields",
      "conga-line",
      "ghost-mode",
      "gold-teeth",
    ];
    const setup = withMutations(
      all,
      setupOf(
        mazeWith([
          { pieceId: "sniper-nest", tile: { column: 5, row: 4 } },
          { pieceId: "lighthouse", tile: { column: 9, row: 8 } },
        ]),
        [...internSquads(2, 6), { dudeKind: "shield-bro", spawnRow: 9 }],
      ),
    );
    const first = runBattle(setup);
    expect(runBattle(setup)).toEqual(first);
    expect(ofType(first.events, "kill").length).toBeGreaterThan(0);
  });

  it("stack: a Split giant becomes two halves of the giant's health", () => {
    const giant = {
      ...internAt(0, 3.5, { giant: true }),
      health: 1,
      fullHealth: INTERN.health * MUTATION_RULES.giantHealthMultiplier,
    };
    const kill = {
      type: "kill" as const,
      step: 1,
      ...NEST,
      dudeId: giant.id,
      dudeKind: giant.kind,
      at: { x: giant.x, y: giant.y },
    };
    const { halves, ghosts } = afterDeaths(
      [kill],
      [giant],
      ["giant", "split", "ghost-mode"],
      1,
      STEPS_PER_SECOND,
      1,
      10,
    );
    expect(halves.map((half) => [half.id, half.health, half.giant])).toEqual([
      [10, giant.fullHealth / 2, false],
      [11, giant.fullHealth / 2, false],
    ]);
    // The halves walk on alive, so the giant leaves no ghost.
    expect(ghosts).toEqual([]);
  });
});
