import type { BattleRules } from "../catalog/battle-rules";
import type { BossId } from "../catalog/bosses";
import type { CurseId } from "../catalog/curses";
import { DUDE_KINDS, isBoss } from "../catalog/dudes";
import type { MutationId } from "../catalog/mutations";
import { PIECES } from "../catalog/pieces";
import { tileKey } from "../maze/board";
import type { Maze } from "../maze/maze";
import type { Route } from "../maze/route";
import {
  slidersAt,
  type SliderInput,
  type SliderPositions,
} from "../tricks/tricks";
import { applyEffects, effectPiecesOf, type EffectPiece } from "./area-effects";
import { giantsOf, isSpawnZonePoint, type Army } from "./army";
import { turnBack, walkLandlord, withBossDude, withBossPiece } from "./bosses";
import {
  curseReloadFactor,
  cursedMaze,
  curseSpeedFactor,
  hypeMenWork,
  powerOn,
  waitsInJam,
  wallBreakersBreak,
  withoutAuditedTax,
} from "./curses";
import {
  hypeSpeedFactor,
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
  /** The Round's Curse; null in Round 1 and in debug scenes. */
  readonly curse: CurseId | null;
  /** The Boss Round's boss; null in every other Round. */
  readonly boss: BossId | null;
}

export type Side = "attack" | "defense";

export interface BattleOutcome {
  readonly winner: Side;
  readonly reason: "goal-destroyed" | "army-gone" | "time-up";
  /** The step the battle ended in. */
  readonly step: number;
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

/**
 * The Army's Dudes as they stand at step 0, ids in paint order, made as the Mutations make them.
 * The renderer draws these while building, too.
 */
export function armyDudes(
  army: Army,
  mutations: readonly MutationId[],
  windowSize: number,
): DudeState[] {
  const giants = giantsOf(army);
  return army.map((placed, index) => {
    if (!isSpawnZonePoint(placed.at, windowSize)) {
      throw new ArmySetupError(
        `A ${placed.dudeKind} stands at (${String(placed.at.x)}, ${String(placed.at.y)}), which is not in the Spawn zone at Window size ${String(windowSize)}.`,
      );
    }
    const dude = newDude(index, placed.dudeKind, placed.at);
    return mutatedDude(dude, placed.stroke, giants[index] ?? false, mutations);
  });
}

/** The battle before its first step: the whole Army standing in the Spawn zone, towers ready. */
export function startBattle(setup: BattleSetup): BattleState {
  // The boss goes in after the Earthquake, so the run can still work out which Piece it shook.
  const maze = withBossPiece(
    cursedMaze(setup.maze, setup.curse, setup.seed),
    setup.boss,
  );
  const dudes = withBossDude(
    armyDudes(setup.army, setup.mutations, maze.windowSize),
    setup.boss,
  );
  const hasWallBreakers =
    wallBreakersBreak(setup.curse) &&
    setup.army.some(({ dudeKind }) => isWallBreaker(dudeKind));
  return {
    step: 0,
    goalHealth: setup.rules.goalHealth,
    maze,
    pieceHealth: new Map(),
    breakerRoutes: hasWallBreakers ? breakerRoutesOf(maze) : null,
    decoyRoutes: decoyRoutesOf(maze),
    trapCooldowns: new Map(),
    dudes,
    ghosts: [],
    nextDudeId: dudes.length,
    towers: towersOf(maze),
    effectPieces: powerOn(setup.curse) ? effectPiecesOf(maze) : [],
    events: [],
    outcome: null,
  };
}

/** One fixed step: towers fire, Dudes walk, then the end is checked. A finished battle stays as it is. */
export function stepBattle(
  setup: BattleSetup,
  state: BattleState,
): BattleState {
  if (state.outcome !== null) return state;
  const step = state.step + 1;

  const onBoard = state.dudes;
  // The routes belong to the Maze, worked out again only when a Wall-breaker destroys a Piece.
  const route = routeAt(state.maze, step);
  const sliders = slidersAt(setup.sliders, setup.sliderInputs, step);
  const trickSpeed = dudeSpeedFactor(sliders) * curseSpeedFactor(setup.curse);
  const tricks = towerTricks(sliders, state.maze, powerOn(setup.curse));
  const volley = fireTowers(
    state.towers,
    onBoard,
    route,
    step,
    STEPS_PER_SECOND,
    {
      ...tricks,
      reloadFactor: tricks.reloadFactor * curseReloadFactor(setup.curse),
    },
  );
  const effects = applyEffects(
    state.effectPieces,
    volley.dudes,
    step,
    STEPS_PER_SECOND,
    sliders.volume,
  );

  const events = [...volley.events, ...effects.events];
  const dudes: DudeState[] = [];
  let goalHealth = state.goalHealth;
  const hypeMen = hypeMenWork(setup.curse)
    ? effects.dudes.filter((dude) => DUDE_KINDS[dude.kind].hypeAura !== null)
    : [];
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
  const bounced = turnBack(
    state.maze,
    bounce(state.maze, effects.dudes, cooldowns, step, STEPS_PER_SECOND),
    cooldowns,
    step,
    STEPS_PER_SECOND,
  );
  const floorHits = new DudeHits(bounced, step, events);
  for (const placed of bounced) {
    // A Conga Line Stroke-mate's Grinder hit earlier in this loop may have hurt or killed it.
    const dude = floorHits.current(placed);
    if (dude === null) continue;
    if (
      (dude.stunnedUntilStep ?? 0) > step ||
      waitsInJam(setup.curse, dude, setup.army.length, step, STEPS_PER_SECOND)
    ) {
      dudes.push(dude);
      continue;
    }
    let field = route;
    // A Decoy Goal doesn't fool a boss.
    if (
      !isWallBreaker(dude.kind) &&
      !DUDE_KINDS[dude.kind].flies &&
      !isBoss(dude.kind)
    ) {
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
        : hypeSpeedFactor(dude, hypeMen, sliders.volume)) *
      carrierSpeedFactor(dude) *
      mutationSpeedFactor(dude);
    const moved = walk(dude, field, STEP_SECONDS, speedFactor);
    if (moved !== "at-goal") {
      const crossed = crossFloor(
        dude,
        walkLandlord(dude, moved, state.maze, pieceHits, step, events),
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
    // The Mutations are the Army's; a boss doesn't split or walk on as a ghost.
    events.filter(
      (event): event is KillEvent =>
        event.type === "kill" && !isBoss(event.dudeKind),
    ),
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
    ghosts,
    nextDudeId: afterlife.nextDudeId,
    events: withoutAuditedTax(setup.curse, events),
    outcome: outcomeAfter(
      setup.rules,
      step,
      goalHealth,
      living.length + ghosts.length,
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
  /** Dudes on the Board and walking as ghosts. */
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
