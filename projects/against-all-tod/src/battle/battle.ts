import type { BattleRules } from "../catalog/battle-rules";
import { DUDE_KINDS } from "../catalog/dudes";
import type { MutationId } from "../catalog/mutations";
import { PIECES } from "../catalog/pieces";
import { isOnBoard, tileKey, tileKind } from "../maze/board";
import type { Maze } from "../maze/maze";
import type { Route } from "../maze/route";
import { createRng } from "../rng/rng";
import {
  slidersAt,
  type SliderInput,
  type SliderPositions,
} from "../tricks/tricks";
import { applyEffects, effectPiecesOf, type EffectPiece } from "./area-effects";
import type { Army } from "./army";
import {
  hypeSpeedFactor,
  MAX_LANE,
  newDude,
  reachGoal,
  tileUnder,
  walk,
  type DudeState,
} from "./dudes";
import { DudeHits } from "./damage";
import type { BattleEvent, KillEvent } from "./events";
import {
  afterDeaths,
  mutatedDude,
  mutationSpeedFactor,
  stunTowers,
  walkGhosts,
  type Ghost,
} from "./mutations";
import { fireTowers, towersOf, type TowerState } from "./towers";
import {
  bounce,
  crossFloor,
  decoyRoutesOf,
  walkerRoute,
  type DecoyRoutes,
  type TrapCooldowns,
} from "./traps";
import { dudeSpeedFactor, towerTricks } from "./tricks";
import {
  breakerRoute,
  breakerRoutesOf,
  carrierSpeedFactor,
  isWallBreaker,
  PieceHits,
  withoutDestroyed,
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
  /** Every Mutation the Army has; they all apply to every Dude. */
  readonly mutations: readonly MutationId[];
  readonly seed: number;
  readonly rules: BattleRules;
  /** Where the Settings sliders stand as the battle starts. */
  readonly sliders: SliderPositions;
  /** Sliders dragged mid-battle, in step order; recorded so the battle replays the same. */
  readonly sliderInputs: readonly SliderInput[];
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
  /** The fields to the Decoy Goals; null once none is standing. */
  readonly decoyRoutes: DecoyRoutes | null;
  /** When each jammed Grinder or spent Bouncer works again. */
  readonly trapCooldowns: TrapCooldowns;
  readonly dudes: readonly DudeState[];
  readonly waiting: readonly WaitingDude[];
  /** Ghost Mode's dead still walking; kept apart, as nothing can touch them. */
  readonly ghosts: readonly Ghost[];
  /** The id the next new Dude (a Split half) gets. */
  readonly nextDudeId: number;
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
  for (const [squadIndex, squad] of setup.army.entries()) {
    if (!isSpawnLineRow(squad.spawnRow)) {
      throw new ArmySetupError(
        `A Squad of ${squad.dudeKind} is on row ${String(squad.spawnRow)}, which is not on the Spawn line.`,
      );
    }
    const kind = DUDE_KINDS[squad.dudeKind];
    for (let index = 0; index < kind.squadSize; index++) {
      const lane = (rng() * 2 - 1) * MAX_LANE;
      const dude = newDude(waiting.length, kind.id, squad.spawnRow, lane);
      waiting.push({
        dude: mutatedDude(dude, squadIndex, index, setup.mutations),
        entersAtStep: Math.round(
          index * kind.spawnIntervalSeconds * STEPS_PER_SECOND,
        ),
      });
    }
  }
  const hasWallBreakers = setup.army.some(({ dudeKind }) =>
    isWallBreaker(dudeKind),
  );
  return {
    step: 0,
    goalHealth: setup.rules.goalHealth,
    maze: setup.maze,
    pieceHealth: new Map(),
    breakerRoutes: hasWallBreakers ? breakerRoutesOf(setup.maze) : null,
    decoyRoutes: decoyRoutesOf(setup.maze),
    trapCooldowns: new Map(),
    dudes: [],
    waiting,
    ghosts: [],
    nextDudeId: waiting.length,
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
  const sliders = slidersAt(setup.sliders, setup.sliderInputs, step);
  const trickSpeed = dudeSpeedFactor(sliders);
  const volley = fireTowers(
    state.towers,
    onBoard,
    route,
    step,
    STEPS_PER_SECOND,
    towerTricks(sliders, state.maze),
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
  const cooldowns = new Map(state.trapCooldowns);
  const decoyRoute =
    state.decoyRoutes === null
      ? null
      : turnstilesTurned(step)
        ? state.decoyRoutes.turned
        : state.decoyRoutes.unturned;
  const bounced = bounce(
    state.maze,
    effects.dudes,
    cooldowns,
    step,
    STEPS_PER_SECOND,
  );
  const floorHits = new DudeHits(bounced, step, events);
  for (const placed of bounced) {
    // A Conga Line Squadmate's Grinder hit earlier in this loop may have hurt or killed it.
    const dude = floorHits.current(placed);
    if (dude === null) continue;
    if ((dude.stunnedUntilStep ?? 0) > step) {
      dudes.push(dude);
      continue;
    }
    let field = route;
    if (!isWallBreaker(dude.kind) && !DUDE_KINDS[dude.kind].flies) {
      field = walkerRoute(dude, decoyRoute, route);
    }
    if (breakerRoutes !== null && isWallBreaker(dude.kind)) {
      field = breakerRoute(dude, breakerRoutes, route);
      const hit = pieceHits.hitInTheWay(
        dude,
        field,
        state.maze,
        step,
        STEPS_PER_SECOND,
      );
      if (hit !== null) {
        if (hit.dude !== null) dudes.push(hit.dude);
        else floorHits.leave(dude);
        if (hit.destroyed !== null) events.push(hit.destroyed);
        continue;
      }
    }
    const speedFactor =
      trickSpeed *
      (hypeMen.length === 0
        ? 1
        : hypeSpeedFactor(dude, hypeMen, setup.rules.volumeLevel)) *
      carrierSpeedFactor(dude) *
      mutationSpeedFactor(dude);
    const moved = walk(dude, field, STEP_SECONDS, speedFactor);
    if (moved !== "at-goal") {
      const crossed = crossFloor(
        dude,
        moved,
        state.maze,
        cooldowns,
        step,
        STEPS_PER_SECOND,
        events,
        floorHits,
      );
      if (crossed !== null) dudes.push(crossed);
      continue;
    }
    floorHits.leave(dude);
    if (field === decoyRoute) {
      events.push(hitDecoy(dude, state.maze, pieceHits, step));
      continue;
    }
    const reached = reachGoal(dude, step);
    goalHealth = Math.max(0, goalHealth - reached.damage);
    events.push(reached);
  }

  const ghostWalk = walkGhosts(state.ghosts, route, step, STEP_SECONDS, events);
  goalHealth = Math.max(0, goalHealth - ghostWalk.goalDamage);
  const afterlife = afterDeaths(
    events.filter((event): event is KillEvent => event.type === "kill"),
    onBoard,
    setup.mutations,
    step,
    STEPS_PER_SECOND,
    setup.seed,
    state.nextDudeId,
  );
  const living = [...floorHits.applyTo(dudes), ...afterlife.halves];
  const ghosts = [...ghostWalk.ghosts, ...afterlife.ghosts];

  const towers = stunTowers(volley.towers, events, step, STEPS_PER_SECOND);
  const standing = withoutDestroyed(state, towers, pieceHits.destroyed);
  return {
    ...standing,
    decoyRoutes:
      standing.maze === state.maze
        ? state.decoyRoutes
        : decoyRoutesOf(standing.maze),
    trapCooldowns: cooldowns,
    step,
    goalHealth,
    pieceHealth: pieceHits.pieceHealth(),
    dudes: living,
    waiting,
    ghosts,
    nextDudeId: afterlife.nextDudeId,
    events,
    outcome: outcomeAfter(
      setup.rules,
      step,
      goalHealth,
      living.length + waiting.length + ghosts.length,
    ),
  };
}

/** A Dude on a Decoy Goal hits it with its Goal damage and vanishes. */
function hitDecoy(
  dude: DudeState,
  maze: Maze,
  pieceHits: PieceHits,
  step: number,
): BattleEvent {
  const tile = tileUnder(dude);
  const damage = DUDE_KINDS[dude.kind].goalDamage;
  const piece = maze.pieces.get(tileKey(tile));
  if (piece !== undefined) pieceHits.damage(piece, damage);
  return {
    type: "decoy-hit",
    step,
    pieceTile: tile,
    dudeId: dude.id,
    dudeKind: dude.kind,
    damage,
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
  /** Dudes on the Board, waiting and walking as ghosts. */
  attackersLeft: number,
): BattleOutcome | null {
  if (goalHealth <= 0) {
    return { winner: "attack", reason: "goal-destroyed", step };
  }
  if (attackersLeft === 0) {
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
