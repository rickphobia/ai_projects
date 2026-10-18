import { DUDE_KINDS, type DudeKindId } from "../catalog/dudes";
import type { Tile } from "../maze/board";
import { routeStep, type Route, type Step } from "../maze/route";

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
  readonly health: number;
  /** A Siren stunned it: it stands still until this step. Absent if never stunned. */
  readonly stunnedUntilStep?: number;
}

/** The widest a lane may be, in tiles either side of the centre line. */
export const MAX_LANE = 0.3;

const STEP_DIRECTIONS: Readonly<Record<Step, { dx: number; dy: number }>> = {
  right: { dx: 1, dy: 0 },
  left: { dx: -1, dy: 0 },
  down: { dx: 0, dy: 1 },
  up: { dx: 0, dy: -1 },
};

/**
 * Moves a Dude one battle step along the shared route, or reports that it is on the Goal.
 * It only crosses into a new tile along the route's step, and steers sideways only inside its
 * own tile, so it never enters a tile the route doesn't lead to.
 */
export function walk(
  dude: DudeState,
  route: Route,
  stepSeconds: number,
): DudeState | "at-goal" {
  const tile = tileUnder(dude);
  const step = routeStep(route, tile);
  if (step === "at-goal") return "at-goal";
  // The Maze never seals the Goal off, so this only happens on a hand-built Board; stand still.
  if (step === "no-route") return dude;

  const distance = DUDE_KINDS[dude.kind].speed * stepSeconds;
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

/** The tile a Dude is standing on. */
export function tileUnder(dude: DudeState): Tile {
  return { column: Math.floor(dude.x), row: Math.floor(dude.y) };
}

function towards(value: number, target: number, maxChange: number): number {
  if (Math.abs(target - value) <= maxChange) return target;
  return value + Math.sign(target - value) * maxChange;
}
