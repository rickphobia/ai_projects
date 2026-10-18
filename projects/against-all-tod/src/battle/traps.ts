import { DUDE_KINDS } from "../catalog/dudes";
import { PIECES, type TrapStats } from "../catalog/pieces";
import { tileKey, type Tile } from "../maze/board";
import { placedPieces, type Maze, type PlacedPiece } from "../maze/maze";
import {
  computeWeightedRoute,
  distanceToGoal,
  type Route,
} from "../maze/route";
import { squaredDistance, tileUnder, type DudeState } from "./dudes";
import type { BattleEvent } from "./events";

/**
 * The Tax Booth, Grinder, Bouncer and Decoy Goal: Pieces that act on the Dudes crossing or
 * touching them rather than shooting. Only walking Dudes above ground are caught; flyers and
 * Moles underground pass over or under.
 */

/** The step each Grinder unjams or Bouncer is ready again, by `tileKey`; absent means ready. */
export type TrapCooldowns = ReadonlyMap<string, number>;

/** The fields walkers follow to the Decoy Goals, one per Turnstile layout. */
export interface DecoyRoutes {
  readonly unturned: Route;
  readonly turned: Route;
}

function trapOf(piece: PlacedPiece | undefined): TrapStats | null {
  return piece === undefined ? null : PIECES[piece.pieceId].trap;
}

function isCatchable(dude: DudeState): boolean {
  return dude.burrowTo === null && !DUDE_KINDS[dude.kind].flies;
}

/**
 * What the floor Piece a Dude has just stepped onto does to it: the Dude afterwards, or null
 * if the Grinder killed it. Nothing happens unless `after` stands on a new tile.
 */
export function crossFloor(
  before: DudeState,
  after: DudeState,
  maze: Maze,
  cooldowns: Map<string, number>,
  step: number,
  stepsPerSecond: number,
  events: BattleEvent[],
): DudeState | null {
  if (!isCatchable(after)) return after;
  const tile = tileUnder(after);
  const from = tileUnder(before);
  if (tile.column === from.column && tile.row === from.row) return after;
  const key = tileKey(tile);
  const piece = maze.pieces.get(key);
  const trap = trapOf(piece);
  if (piece === undefined || trap === null) return after;
  if (trap.kind === "tax-booth") {
    events.push({
      type: "taxed",
      step,
      pieceTile: tile,
      dudeId: after.id,
      dudeKind: after.kind,
    });
    return after;
  }
  if (trap.kind !== "grinder" || (cooldowns.get(key) ?? 0) > step) {
    return after;
  }
  const health = trap.smallKinds.includes(after.kind)
    ? 0
    : after.health - trap.damage;
  if (health > 0) return { ...after, health };
  cooldowns.set(key, step + Math.round(trap.jamSeconds * stepsPerSecond));
  events.push({
    type: "kill",
    step,
    pieceId: piece.pieceId,
    pieceTile: tile,
    dudeId: after.id,
    dudeKind: after.kind,
    at: { x: after.x, y: after.y },
  });
  return null;
}

/** Every ready Bouncer throws the touching Dude that entered first back to the Spawn line, in its own row. */
export function bounce(
  maze: Maze,
  dudes: readonly DudeState[],
  cooldowns: Map<string, number>,
  step: number,
  stepsPerSecond: number,
): DudeState[] {
  const result = [...dudes];
  for (const piece of placedPieces(maze)) {
    const trap = trapOf(piece);
    if (trap?.kind !== "bouncer") continue;
    const key = tileKey(piece.tile);
    if ((cooldowns.get(key) ?? 0) > step) continue;
    const centre = { x: piece.tile.column + 0.5, y: piece.tile.row + 0.5 };
    let first: number | null = null;
    for (const [index, dude] of result.entries()) {
      if (!isCatchable(dude)) continue;
      if (squaredDistance(dude, centre) > trap.touchRange ** 2) continue;
      if (first === null || dude.id < (result[first]?.id ?? Infinity)) {
        first = index;
      }
    }
    if (first === null) continue;
    const thrown = result[first];
    if (thrown === undefined) continue;
    result[first] = { ...thrown, x: 0.5 };
    cooldowns.set(
      key,
      step + Math.round(trap.cooldownSeconds * stepsPerSecond),
    );
  }
  return result;
}

/** Null when the Maze has no Decoy Goal. */
export function decoyRoutesOf(maze: Maze): DecoyRoutes | null {
  const decoys = placedPieces(maze)
    .filter((piece) => trapOf(piece)?.kind === "decoy-goal")
    .map(({ tile }) => tile);
  if (decoys.length === 0) return null;
  return {
    unturned: fieldTo(decoys, maze.route),
    turned: fieldTo(decoys, maze.turnedRoute),
  };
}

/** The field to the decoys over the tiles Dudes can walk in one layout: those that reach the Goal. */
function fieldTo(decoys: readonly Tile[], route: Route): Route {
  return computeWeightedRoute(
    (tile) => (distanceToGoal(route, tile) === null ? null : 1),
    decoys,
  );
}

/** The field a walker follows: to a Decoy Goal while it can reach one, else `route`. */
export function walkerRoute(
  dude: DudeState,
  decoyRoute: Route | null,
  route: Route,
): Route {
  if (decoyRoute === null) return route;
  return distanceToGoal(decoyRoute, tileUnder(dude)) === null
    ? route
    : decoyRoute;
}
