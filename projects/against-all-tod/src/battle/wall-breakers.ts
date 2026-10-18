import { DUDE_KINDS } from "../catalog/dudes";
import { PIECES } from "../catalog/pieces";
import { isOnBoard, tileKey, type Tile } from "../maze/board";
import {
  wallBreakerRoutes,
  type Maze,
  type PlacedPiece,
  type WallBreakerRoutes,
} from "../maze/maze";
import {
  distanceToGoal,
  routeStep,
  type Route,
  type Step,
} from "../maze/route";
import { tileUnder, type DudeState } from "./dudes";

/**
 * Wall-breakers: the only Dudes that damage Pieces. They follow their own fields from the maze
 * module, and when the next tile on that field holds a blocking Piece, they stand and hit it.
 */

/** The Wall-breakers' fields in both Turnstile layouts, worked out again whenever a Piece falls. */
export interface BreakerRoutes {
  readonly unturned: WallBreakerRoutes;
  readonly turned: WallBreakerRoutes;
}

/** A Wall-breaker's hit: the Piece health it takes, and the Dude after it (null for a Sapper, who is spent). */
export interface Strike {
  readonly damage: number;
  readonly dude: DudeState | null;
}

const STEP_OFFSETS: Readonly<Record<Step, Tile>> = {
  right: { column: 1, row: 0 },
  left: { column: -1, row: 0 },
  down: { column: 0, row: 1 },
  up: { column: 0, row: -1 },
};

export function isWallBreaker(dude: DudeState): boolean {
  return DUDE_KINDS[dude.kind].wallBreaker !== null;
}

export function breakerRoutesOf(maze: Maze): BreakerRoutes {
  return {
    unturned: wallBreakerRoutes(maze, false),
    turned: wallBreakerRoutes(maze, true),
  };
}

/**
 * The field a Wall-breaker follows: the Sapper heads for the nearest wall (or the Goal, once no
 * wall is left he can reach); the others go for the Goal through the walls that matter.
 */
export function breakerRoute(
  dude: DudeState,
  routes: WallBreakerRoutes,
  route: Route,
): Route {
  if (DUDE_KINDS[dude.kind].wallBreaker?.attack !== "blast") {
    return routes.throughWalls;
  }
  const toWall = routes.toNearestWall;
  return distanceToGoal(toWall, tileUnder(dude)) === null ? route : toWall;
}

/** The blocking Piece the field leads into from the Dude's tile; null when the way is open. */
export function pieceInTheWay(
  dude: DudeState,
  field: Route,
  maze: Maze,
): PlacedPiece | null {
  const tile = tileUnder(dude);
  const step = routeStep(field, tile);
  if (step === "at-goal" || step === "no-route") return null;
  const offset = STEP_OFFSETS[step];
  const next = {
    column: tile.column + offset.column,
    row: tile.row + offset.row,
  };
  if (!isOnBoard(next)) return null;
  const piece = maze.pieces.get(tileKey(next));
  return piece !== undefined && PIECES[piece.pieceId].blocksDudes
    ? piece
    : null;
}

/**
 * One step of a Wall-breaker at a Piece: a Termite chews a little every step, a Ram Crew hits
 * once per cooldown, and a Sapper blows up himself and the Piece whatever its health.
 */
export function strike(
  dude: DudeState,
  step: number,
  stepsPerSecond: number,
): Strike {
  const stats = DUDE_KINDS[dude.kind].wallBreaker;
  switch (stats?.attack) {
    case undefined:
      return { damage: 0, dude };
    case "chew":
      return { damage: stats.damagePerSecond / stepsPerSecond, dude };
    case "ram":
      if ((dude.ramReadyAtStep ?? 0) > step) return { damage: 0, dude };
      return {
        damage: stats.damage,
        dude: {
          ...dude,
          ramReadyAtStep:
            step + Math.round(stats.cooldownSeconds * stepsPerSecond),
        },
      };
    case "blast":
      return { damage: Infinity, dude: null };
  }
}

/**
 * The Pieces Wall-breakers hit during one step, in the order they hit them. A Piece destroyed
 * earlier in the step can't be hit again: the Wall-breaker at it waits for the route to open.
 */
export class PieceHits {
  readonly destroyed: PlacedPiece[] = [];
  private readonly health: Map<string, number>;
  private readonly gone = new Set<string>();

  constructor(health: ReadonlyMap<string, number>) {
    this.health = new Map(health);
  }

  /** `dude` strikes `piece`: the Dude afterwards (null if spent), and whether this hit destroyed the Piece. */
  hit(
    dude: DudeState,
    piece: PlacedPiece,
    step: number,
    stepsPerSecond: number,
  ): { readonly dude: DudeState | null; readonly destroyedIt: boolean } {
    const key = tileKey(piece.tile);
    if (this.gone.has(key)) return { dude, destroyedIt: false };
    const struck = strike(dude, step, stepsPerSecond);
    if (struck.damage === 0) return { dude: struck.dude, destroyedIt: false };
    const health =
      (this.health.get(key) ?? PIECES[piece.pieceId].health) - struck.damage;
    if (health > 0) {
      this.health.set(key, health);
      return { dude: struck.dude, destroyedIt: false };
    }
    this.health.delete(key);
    this.gone.add(key);
    this.destroyed.push(piece);
    return { dude: struck.dude, destroyedIt: true };
  }

  /** Health of every damaged Piece still standing, by `tileKey`. */
  pieceHealth(): ReadonlyMap<string, number> {
    return this.health;
  }
}

/** How fast a Ram Crew still goes, as a share of full speed: one share per carrier standing. 1 for other kinds. */
export function carrierSpeedFactor(dude: DudeState): number {
  const kind = DUDE_KINDS[dude.kind];
  if (kind.wallBreaker?.attack !== "ram") return 1;
  const { carriers } = kind.wallBreaker;
  const standing = Math.ceil((dude.health / kind.health) * carriers);
  return Math.max(0, Math.min(carriers, standing)) / carriers;
}
