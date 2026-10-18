import type { BattleRules } from "../catalog/battle-rules";
import { DUDE_KINDS, type DudeKindId } from "../catalog/dudes";
import { isOnBoard, tileKind } from "../maze/board";
import type { Maze } from "../maze/maze";
import { createRng } from "../rng/rng";
import type { Army } from "./army";
import { MAX_LANE, walk, type DudeState } from "./dudes";
import type { BattleEvent } from "./events";
import { fireTowers, towersOf, type TowerState } from "./towers";

/**
 * The battle: a pure function of its setup, stepped at a fixed 1/60 s. No DOM or PixiJS here,
 * so it runs headless in tests and replays identically from the same setup.
 */
export const STEPS_PER_SECOND = 60;
const STEP_SECONDS = 1 / STEPS_PER_SECOND;

export interface BattleSetup {
  readonly maze: Maze;
  readonly army: Army;
  readonly seed: number;
  readonly rules: BattleRules;
}

export type Side = "attack" | "defense";

export interface BattleOutcome {
  readonly winner: Side;
  readonly reason: "goal-destroyed" | "army-gone" | "time-up";
  /** The step the battle ended in. */
  readonly step: number;
}

/** A Dude still waiting on the Spawn line for its turn to walk on. */
export interface WaitingDude {
  readonly dude: DudeState;
  readonly entersAtStep: number;
}

export interface BattleState {
  /** Steps run so far; 0 before the first. */
  readonly step: number;
  readonly goalHealth: number;
  readonly dudes: readonly DudeState[];
  readonly waiting: readonly WaitingDude[];
  readonly towers: readonly TowerState[];
  /** What happened in the latest step only. */
  readonly events: readonly BattleEvent[];
  /** Null while the battle is running. */
  readonly outcome: BattleOutcome | null;
}

export class ArmySetupError extends Error {
  override name = "ArmySetupError";
}

/** The battle before its first step: every Dude waiting on the Spawn line, towers ready. */
export function startBattle(setup: BattleSetup): BattleState {
  const rng = createRng(setup.seed);
  const waiting: WaitingDude[] = [];
  for (const squad of setup.army) {
    if (!isSpawnLineRow(squad.spawnRow)) {
      throw new ArmySetupError(
        `A Squad of ${squad.dudeKind} is on row ${String(squad.spawnRow)}, which is not on the Spawn line.`,
      );
    }
    const kind = DUDE_KINDS[squad.dudeKind];
    for (let index = 0; index < kind.squadSize; index++) {
      const lane = (rng() * 2 - 1) * MAX_LANE;
      waiting.push({
        dude: newDude(waiting.length, kind.id, squad.spawnRow, lane),
        entersAtStep: Math.round(
          index * kind.spawnIntervalSeconds * STEPS_PER_SECOND,
        ),
      });
    }
  }
  return {
    step: 0,
    goalHealth: setup.rules.goalHealth,
    dudes: [],
    waiting,
    towers: towersOf(setup.maze),
    events: [],
    outcome: null,
  };
}

/** One fixed step: Dudes enter, towers fire, Dudes walk, then the end is checked. A finished battle stays as it is. */
export function stepBattle(
  setup: BattleSetup,
  state: BattleState,
): BattleState {
  if (state.outcome !== null) return state;
  const step = state.step + 1;

  const onBoard = [...state.dudes];
  const waiting: WaitingDude[] = [];
  for (const next of state.waiting) {
    if (next.entersAtStep < step) onBoard.push(next.dude);
    else waiting.push(next);
  }
  // The route belongs to the Maze, worked out when a Piece was placed; a step never recomputes it.
  const volley = fireTowers(
    state.towers,
    onBoard,
    setup.maze.route,
    step,
    STEPS_PER_SECOND,
  );

  const events = volley.events;
  const dudes: DudeState[] = [];
  let goalHealth = state.goalHealth;
  for (const dude of volley.dudes) {
    const moved = walk(dude, setup.maze.route, STEP_SECONDS);
    if (moved !== "at-goal") {
      dudes.push(moved);
      continue;
    }
    const damage = DUDE_KINDS[dude.kind].goalDamage;
    goalHealth = Math.max(0, goalHealth - damage);
    events.push({
      type: "reach-goal",
      step,
      dudeId: dude.id,
      dudeKind: dude.kind,
      damage,
    });
  }

  return {
    step,
    goalHealth,
    dudes,
    waiting,
    towers: volley.towers,
    events,
    outcome: outcomeAfter(setup.rules, step, goalHealth, dudes, waiting),
  };
}

export interface StepsResult {
  readonly state: BattleState;
  /** Every event of the steps run, in order. */
  readonly events: readonly BattleEvent[];
}

/** Runs up to `count` steps, stopping early if the battle ends. */
export function stepBattleTimes(
  setup: BattleSetup,
  state: BattleState,
  count: number,
): StepsResult {
  const events: BattleEvent[] = [];
  let current = state;
  for (let index = 0; index < count && current.outcome === null; index++) {
    current = stepBattle(setup, current);
    events.push(...current.events);
  }
  return { state: current, events };
}

/** The whole battle, start to end, headless. */
export function runBattle(setup: BattleSetup): StepsResult {
  // The time limit always ends it, so this many steps is enough.
  const maxSteps =
    Math.ceil(setup.rules.timeLimitSeconds * STEPS_PER_SECOND) + 1;
  return stepBattleTimes(setup, startBattle(setup), maxSteps);
}

function outcomeAfter(
  rules: BattleRules,
  step: number,
  goalHealth: number,
  dudes: readonly DudeState[],
  waiting: readonly WaitingDude[],
): BattleOutcome | null {
  if (goalHealth <= 0) {
    return { winner: "attack", reason: "goal-destroyed", step };
  }
  if (dudes.length === 0 && waiting.length === 0) {
    return { winner: "defense", reason: "army-gone", step };
  }
  if (step >= rules.timeLimitSeconds * STEPS_PER_SECOND) {
    return { winner: "defense", reason: "time-up", step };
  }
  return null;
}

function newDude(
  id: number,
  kind: DudeKindId,
  spawnRow: number,
  lane: number,
): DudeState {
  return {
    id,
    kind,
    x: 0.5,
    y: spawnRow + 0.5 + lane,
    lane,
    health: DUDE_KINDS[kind].health,
  };
}

function isSpawnLineRow(row: number): boolean {
  const tile = { column: 0, row };
  return isOnBoard(tile) && tileKind(tile) === "spawn-line";
}
