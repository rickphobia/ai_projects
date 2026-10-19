import { DUDE_KINDS, type DudeKindId } from "../catalog/dudes";
import { BOARD_COLUMNS, BOARD_ROWS, isOnBoard, type Tile } from "../maze/board";
import {
  distanceToGoal,
  routeStep,
  type Route,
  type Step,
} from "../maze/route";
import type { BoardPoint, ReachGoalEvent } from "./events";

/** One Dude on the Board. */
export interface DudeState {
  /** Unique within a battle, in the order Dudes enter. */
  readonly id: number;
  readonly kind: DudeKindId;
  /** In tiles; see `BoardPoint`. */
  readonly x: number;
  readonly y: number;
  /**
   * How far off the tile centre line this Dude walks, so a Squad spreads out instead of
   * stacking on one point. Kept well inside the tile so it never brushes a wall.
   */
  readonly lane: number;
  /** Where it stood as the battle started; the Bouncer throws it back here. */
  readonly start: BoardPoint;
  readonly health: number;
  /** The health it started the battle with: its kind's, or more or less under a Mutation. */
  readonly fullHealth: number;
  /** Damage its shield can still soak; 0 for no shield or a broken one. */
  readonly shield: number;
  /** Tunnels it may still dig this battle. */
  readonly tunnelsLeft: number;
  /** Where it will resurface while underground, where no tower can target it; null above ground. */
  readonly burrowTo: BoardPoint | null;
  /** A Siren stunned it: it stands still until this step. Absent if never stunned. */
  readonly stunnedUntilStep?: number;
  /** A Ram Crew's ram swings again from this step. Absent before its first hit. */
  readonly ramReadyAtStep?: number;
  /** Explosive Shields: damage its own small shield can still soak. Absent without the Mutation. */
  readonly smallShield?: number;
  /** Conga Line: its Squad's index in the Army; Squadmates share damage. Absent without the Mutation. */
  readonly congaSquad?: number;
  /** Giant: this Squad's giant, at its kind's speed times the Giant multiplier. */
  readonly giant: boolean;
  /** Split: one of the two halves a dead Dude became; a half doesn't split again. */
  readonly half: boolean;
}

/** The widest a lane may be, in tiles either side of the centre line. */
export const MAX_LANE = 0.3;

/** Balloonists aim for the middle of the Goal's right edge, between its two tiles. */
const GOAL_POINT: BoardPoint = { x: BOARD_COLUMNS - 0.5, y: BOARD_ROWS / 2 };

const STEP_DIRECTIONS: Readonly<Record<Step, { dx: number; dy: number }>> = {
  right: { dx: 1, dy: 0 },
  left: { dx: -1, dy: 0 },
  down: { dx: 0, dy: 1 },
  up: { dx: 0, dy: -1 },
};

/**
 * A Dude of `kind` standing at `at` in the Spawn zone as the battle starts. Its lane is how far
 * it stands off its row's centre line, kept to the widest lane.
 */
export function newDude(
  id: number,
  kind: DudeKindId,
  at: BoardPoint,
): DudeState {
  const entry = DUDE_KINDS[kind];
  const offCentre = at.y - (Math.floor(at.y) + 0.5);
  return {
    id,
    kind,
    x: at.x,
    y: at.y,
    lane: Math.max(-MAX_LANE, Math.min(MAX_LANE, offCentre)),
    start: at,
    health: entry.health,
    fullHealth: entry.health,
    shield: entry.shield?.health ?? 0,
    tunnelsLeft: entry.tunnelTiles > 0 ? 1 : 0,
    burrowTo: null,
    giant: false,
    half: false,
  };
}

/**
 * Moves a Dude one battle step, or reports that it is on the Goal. Walkers follow the shared
 * route: they only cross into a new tile along the route's step, and steer sideways only inside
 * their own tile, so they never enter a tile the route doesn't lead to. Flyers go straight to
 * the Goal; a Mole may dig straight under the Maze once. `speedFactor` is any Hype boost.
 */
export function walk(
  dude: DudeState,
  route: Route,
  stepSeconds: number,
  speedFactor = 1,
): DudeState | "at-goal" {
  const distance = DUDE_KINDS[dude.kind].speed * speedFactor * stepSeconds;
  if (dude.burrowTo !== null) return dig(dude, dude.burrowTo, distance);

  const tile = tileUnder(dude);
  if (DUDE_KINDS[dude.kind].flies) {
    if (distanceToGoal(route, tile) === 0) return "at-goal";
    return moveTowards(
      dude,
      { x: GOAL_POINT.x, y: GOAL_POINT.y + dude.lane },
      distance,
    );
  }
  const step = routeStep(route, tile);
  if (step === "at-goal") return "at-goal";
  // The Maze never seals the Goal off, so this only happens on a hand-built Board; stand still.
  if (step === "no-route") return dude;

  if (dude.tunnelsLeft > 0) {
    const exit = tunnelExit(tile, route, DUDE_KINDS[dude.kind].tunnelTiles);
    if (exit !== null) {
      const burrowTo = { x: exit.column + 0.5, y: exit.row + 0.5 + dude.lane };
      return dig(
        { ...dude, tunnelsLeft: dude.tunnelsLeft - 1, burrowTo },
        burrowTo,
        distance,
      );
    }
  }

  const { dx, dy } = STEP_DIRECTIONS[step];
  if (dx !== 0) {
    return {
      ...dude,
      x: dude.x + dx * distance,
      y: towards(dude.y, tile.row + 0.5 + dude.lane, distance),
    };
  }
  return {
    ...dude,
    x: towards(dude.x, tile.column + 0.5 + dude.lane, distance),
    y: dude.y + dy * distance,
  };
}

/**
 * Where a Mole on `tile` would resurface: when the tile toward the Goal is blocked, the first
 * open tile past it, at most `tunnelTiles` blocked tiles on, that is nearer the Goal by route.
 * Null when there is nothing to dig under or no such tile.
 */
export function tunnelExit(
  tile: Tile,
  route: Route,
  tunnelTiles: number,
): Tile | null {
  const here = distanceToGoal(route, tile);
  if (here === null) return null;
  const next = { column: tile.column + 1, row: tile.row };
  if (!isOnBoard(next) || distanceToGoal(route, next) !== null) return null;
  for (let ahead = 2; ahead <= tunnelTiles + 1; ahead++) {
    const exit = { column: tile.column + ahead, row: tile.row };
    if (!isOnBoard(exit)) return null;
    const there = distanceToGoal(route, exit);
    if (there !== null) return there < here ? exit : null;
  }
  return null;
}

/**
 * How much faster the Hype Men around `dude` make it: 1 for no boost. Boosts don't stack; the
 * Volume level (-2 to 2, 0 neutral) scales the boost up or down. A Hype Man doesn't boost himself.
 */
export function hypeSpeedFactor(
  dude: DudeState,
  hypeMen: readonly DudeState[],
  volumeLevel: number,
): number {
  let best = 1;
  for (const hypeMan of hypeMen) {
    const aura = DUDE_KINDS[hypeMan.kind].hypeAura;
    if (aura === null || hypeMan.id === dude.id) continue;
    if (squaredDistance(dude, hypeMan) > aura.range * aura.range) continue;
    const boost =
      aura.speedBoost * Math.max(0, 1 + aura.boostPerVolumeStep * volumeLevel);
    best = Math.max(best, 1 + boost);
  }
  return best;
}

/** What a Dude reaching the Goal emits: the Goal health it takes is its kind's Goal damage. */
export function reachGoal(dude: DudeState, step: number): ReachGoalEvent {
  return {
    type: "reach-goal",
    step,
    dudeId: dude.id,
    dudeKind: dude.kind,
    damage: DUDE_KINDS[dude.kind].goalDamage,
  };
}

/** The tile a Dude is standing on. */
export function tileUnder(dude: DudeState): Tile {
  return { column: Math.floor(dude.x), row: Math.floor(dude.y) };
}

export function squaredDistance(a: BoardPoint, b: BoardPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function dig(dude: DudeState, to: BoardPoint, distance: number): DudeState {
  const moved = moveTowards(dude, to, distance);
  const surfaced = moved.x === to.x && moved.y === to.y;
  return surfaced ? { ...moved, burrowTo: null } : moved;
}

/** Straight-line movement, landing exactly on `to` once within reach. */
function moveTowards(
  dude: DudeState,
  to: BoardPoint,
  distance: number,
): DudeState {
  const gap = Math.sqrt(squaredDistance(dude, to));
  if (gap <= distance) return { ...dude, x: to.x, y: to.y };
  return {
    ...dude,
    x: dude.x + ((to.x - dude.x) / gap) * distance,
    y: dude.y + ((to.y - dude.y) / gap) * distance,
  };
}

function towards(value: number, target: number, maxChange: number): number {
  if (Math.abs(target - value) <= maxChange) return target;
  return value + Math.sign(target - value) * maxChange;
}
