import type { BattleRules } from "../catalog/battle-rules";
import { DUDE_KINDS } from "../catalog/dudes";
import { PIECES } from "../catalog/pieces";
import { isOnBoard, tileKey, tileKind, type Tile } from "../maze/board";
import { removePiece, type Maze, type PlacedPiece } from "../maze/maze";
import type { Route } from "../maze/route";
import { createRng } from "../rng/rng";
import { applyEffects, effectPiecesOf, type EffectPiece } from "./area-effects";
import type { Army } from "./army";
import {
  hypeSpeedFactor,
  MAX_LANE,
  newDude,
  walk,
  type DudeState,
} from "./dudes";
import type { BattleEvent } from "./events";
import { fireTowers, towersOf, type TowerState } from "./towers";
import {
  breakerRoute,
  breakerRoutesOf,
  carrierSpeedFactor,
  isWallBreaker,
  PieceHits,
  pieceInTheWay,
  type BreakerRoutes,
} from "./wall-breakers";

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
  /** The Maze as it stands: the setup's, less the Pieces Wall-breakers have destroyed. */
  readonly maze: Maze;
  /** Health of each Piece a Wall-breaker has damaged, by `tileKey`; the rest are at full health. */
  readonly pieceHealth: ReadonlyMap<string, number>;
  /** The Wall-breakers' fields; null when the Army has no Wall-breakers. */
  readonly breakerRoutes: BreakerRoutes | null;
  readonly dudes: readonly DudeState[];
  readonly waiting: readonly WaitingDude[];
  readonly towers: readonly TowerState[];
  /** Lighthouses and Sirens, which act on the battle clock rather than on a cooldown. */
  readonly effectPieces: readonly EffectPiece[];
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
  const hasWallBreakers = setup.army.some(
    ({ dudeKind }) => DUDE_KINDS[dudeKind].wallBreaker !== null,
  );
  return {
    step: 0,
    goalHealth: setup.rules.goalHealth,
    maze: setup.maze,
    pieceHealth: new Map(),
    breakerRoutes: hasWallBreakers ? breakerRoutesOf(setup.maze) : null,
    dudes: [],
    waiting,
    towers: towersOf(setup.maze),
    effectPieces: effectPiecesOf(setup.maze),
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
  // The routes belong to the Maze, worked out again only when a Wall-breaker destroys a Piece.
  const route = routeAt(state.maze, step);
  const volley = fireTowers(
    state.towers,
    onBoard,
    route,
    step,
    STEPS_PER_SECOND,
  );
  const effects = applyEffects(
    state.effectPieces,
    volley.dudes,
    step,
    STEPS_PER_SECOND,
    setup.rules.volumeLevel,
  );

  const events = [...volley.events, ...effects.events];
  const dudes: DudeState[] = [];
  let goalHealth = state.goalHealth;
  const hypeMen = effects.dudes.filter(
    (dude) => DUDE_KINDS[dude.kind].hypeAura !== null,
  );
  const breakerRoutes =
    state.breakerRoutes === null
      ? null
      : turnstilesTurned(step)
        ? state.breakerRoutes.turned
        : state.breakerRoutes.unturned;
  const pieceHits = new PieceHits(state.pieceHealth);
  for (const dude of effects.dudes) {
    if ((dude.stunnedUntilStep ?? 0) > step) {
      dudes.push(dude);
      continue;
    }
    let field = route;
    if (breakerRoutes !== null && isWallBreaker(dude)) {
      field = breakerRoute(dude, breakerRoutes, route);
      const piece = pieceInTheWay(dude, field, state.maze);
      if (piece !== null) {
        const hit = pieceHits.hit(dude, piece, step, STEPS_PER_SECOND);
        if (hit.dude !== null) dudes.push(hit.dude);
        if (hit.destroyedIt) {
          events.push({
            type: "piece-destroyed",
            step,
            pieceId: piece.pieceId,
            pieceTile: piece.tile,
            dudeId: dude.id,
            dudeKind: dude.kind,
          });
        }
        continue;
      }
    }
    const speedFactor =
      (hypeMen.length === 0
        ? 1
        : hypeSpeedFactor(dude, hypeMen, setup.rules.volumeLevel)) *
      carrierSpeedFactor(dude);
    const moved = walk(dude, field, STEP_SECONDS, speedFactor);
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
    ...withoutDestroyed(state, volley.towers, pieceHits.destroyed),
    step,
    goalHealth,
    pieceHealth: pieceHits.pieceHealth(),
    dudes,
    waiting,
    events,
    outcome: outcomeAfter(setup.rules, step, goalHealth, dudes, waiting),
  };
}

/** The Maze and what acts from it, less the Pieces destroyed this step, with the routes worked out again. */
function withoutDestroyed(
  state: BattleState,
  towers: readonly TowerState[],
  destroyed: readonly PlacedPiece[],
): Pick<BattleState, "maze" | "towers" | "effectPieces" | "breakerRoutes"> {
  if (destroyed.length === 0) {
    return {
      maze: state.maze,
      towers,
      effectPieces: state.effectPieces,
      breakerRoutes: state.breakerRoutes,
    };
  }
  const maze = destroyed.reduce(
    (current, { tile }) => removePiece(current, tile),
    state.maze,
  );
  const standing = ({ tile }: { readonly tile: Tile }) =>
    maze.pieces.has(tileKey(tile));
  return {
    maze,
    towers: towers.filter(standing),
    effectPieces: state.effectPieces.filter(standing),
    breakerRoutes: breakerRoutesOf(maze),
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

const TURN_STEPS =
  (PIECES.turnstile.turnIntervalSeconds ?? 1) * STEPS_PER_SECOND;

/** Whether the Turnstiles stand turned at `step`: all turn together, starting unturned. */
export function turnstilesTurned(step: number): boolean {
  return Math.floor(step / TURN_STEPS) % 2 === 1;
}

/** The route Dudes follow at `step`. */
export function routeAt(maze: Maze, step: number): Route {
  return turnstilesTurned(step) ? maze.turnedRoute : maze.route;
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

function isSpawnLineRow(row: number): boolean {
  const tile = { column: 0, row };
  return isOnBoard(tile) && tileKind(tile) === "spawn-line";
}
