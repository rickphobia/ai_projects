import { WALL_BREAKER_PIECE_COST } from "../catalog/dudes";
import { PIECES, type PieceId } from "../catalog/pieces";
import {
  isOnBoard,
  spawnLineTiles,
  tileKey,
  tileKind,
  type Tile,
} from "./board";
import {
  computeRoute,
  computeWeightedRoute,
  reachesGoal,
  type Route,
} from "./route";

/**
 * Everything the defender has placed on the Board, plus the route Dudes take through it.
 * Immutable: placing a Piece returns a new Maze, so a Rewind can keep the old one.
 */
export interface Maze {
  /** Keyed by `tileKey`. */
  readonly pieces: ReadonlyMap<string, PlacedPiece>;
  readonly route: Route;
  /** The route while every Turnstile stands turned; the same object as `route` when there are none. */
  readonly turnedRoute: Route;
}

export interface PlacedPiece {
  readonly pieceId: PieceId;
  readonly tile: Tile;
}

/** Why a placement was refused, for the HUD message and the log. */
export type PlacementRefusal =
  "off-board" | "spawn-line" | "goal" | "tile-taken" | "seals-goal";

export type PlacementResult =
  | { readonly ok: true; readonly maze: Maze }
  | { readonly ok: false; readonly refusal: PlacementRefusal };

export function emptyMaze(): Maze {
  return withPieces(new Map());
}

export function pieceAt(maze: Maze, tile: Tile): PieceId | undefined {
  return maze.pieces.get(tileKey(tile))?.pieceId;
}

export function placedPieces(maze: Maze): PlacedPiece[] {
  return [...maze.pieces.values()];
}

/** Null when `pieceId` may go on `tile`; otherwise why not. */
export function checkPlacement(
  maze: Maze,
  tile: Tile,
  pieceId: PieceId,
): PlacementRefusal | null {
  const result = placePiece(maze, tile, pieceId);
  return result.ok ? null : result.refusal;
}

export function placePiece(
  maze: Maze,
  tile: Tile,
  pieceId: PieceId,
): PlacementResult {
  if (!isOnBoard(tile)) return refuse("off-board");
  const kind = tileKind(tile);
  if (kind === "spawn-line") return refuse("spawn-line");
  if (kind === "goal") return refuse("goal");
  if (pieceAt(maze, tile) !== undefined) return refuse("tile-taken");

  const placed = withPieces(
    new Map(maze.pieces).set(tileKey(tile), { pieceId, tile }),
  );
  if (
    PIECES[pieceId].blocksDudes &&
    !(
      spawnLineReachesGoal(placed.route) &&
      spawnLineReachesGoal(placed.turnedRoute)
    )
  ) {
    return refuse("seals-goal");
  }
  return { ok: true, maze: placed };
}

/** The Spawn line is all walkable and joined top to bottom, so one of its tiles reaching the Goal means all do. */
function spawnLineReachesGoal(route: Route): boolean {
  return spawnLineTiles().some((tile) => reachesGoal(route, tile));
}

/**
 * The open tiles a Turnstile's arms block: left and right of it, or above and below once
 * turned. All Turnstiles turn together, so a Maze only ever has these two layouts.
 */
export function turnstileArms(tile: Tile, turned: boolean): Tile[] {
  const arms = turned
    ? [
        { column: tile.column, row: tile.row - 1 },
        { column: tile.column, row: tile.row + 1 },
      ]
    : [
        { column: tile.column - 1, row: tile.row },
        { column: tile.column + 1, row: tile.row },
      ];
  return arms.filter((arm) => isOnBoard(arm) && tileKind(arm) === "open");
}

/** The Maze without the Piece on `tile`, with its routes worked out again; unchanged if the tile is empty. */
export function removePiece(maze: Maze, tile: Tile): Maze {
  const key = tileKey(tile);
  if (!maze.pieces.has(key)) return maze;
  const pieces = new Map(maze.pieces);
  pieces.delete(key);
  return withPieces(pieces);
}

/** The direction fields Wall-breakers follow instead of the route, for one Turnstile layout. */
export interface WallBreakerRoutes {
  /**
   * To the Goal, with blocking Pieces passable at `WALL_BREAKER_PIECE_COST`, so a Wall-breaker
   * heads for the wall that matters: where a step leads into a Piece, that Piece is in its way.
   */
  readonly throughWalls: Route;
  /** To the nearest blocking Piece, for the Sapper; it reaches nothing in a Maze without one. */
  readonly toNearestWall: Route;
}

/**
 * Worked out for the battle rather than kept on the Maze: only a battle with Wall-breakers
 * needs them, and placing a Piece shouldn't pay for them.
 */
export function wallBreakerRoutes(
  maze: Maze,
  turned: boolean,
): WallBreakerRoutes {
  const arms = armsOf(maze.pieces, turned);
  const blocking = placedPieces(maze).filter(
    ({ pieceId }) => PIECES[pieceId].blocksDudes,
  );
  const blocks = new Set(blocking.map(({ tile }) => tileKey(tile)));
  const throughWalls = computeWeightedRoute((tile) => {
    const key = tileKey(tile);
    if (arms.has(key)) return null;
    return blocks.has(key) ? WALL_BREAKER_PIECE_COST : 1;
  });
  const toNearestWall = computeWeightedRoute(
    (tile) => {
      const key = tileKey(tile);
      return arms.has(key) || blocks.has(key) ? null : 1;
    },
    blocking.map(({ tile }) => tile),
  );
  return { throughWalls, toNearestWall };
}

function withPieces(pieces: ReadonlyMap<string, PlacedPiece>): Maze {
  const route = routeAround(pieces, false);
  const turnedRoute = hasTurnstile(pieces) ? routeAround(pieces, true) : route;
  return { pieces, route, turnedRoute };
}

function hasTurnstile(pieces: ReadonlyMap<string, PlacedPiece>): boolean {
  return [...pieces.values()].some(
    ({ pieceId }) => PIECES[pieceId].turnIntervalSeconds !== null,
  );
}

/** The tiles every Turnstile's arms block in one layout, by `tileKey`. */
function armsOf(
  pieces: ReadonlyMap<string, PlacedPiece>,
  turned: boolean,
): Set<string> {
  return new Set(
    [...pieces.values()]
      .filter(({ pieceId }) => PIECES[pieceId].turnIntervalSeconds !== null)
      .flatMap(({ tile }) => turnstileArms(tile, turned).map(tileKey)),
  );
}

function routeAround(
  pieces: ReadonlyMap<string, PlacedPiece>,
  turned: boolean,
): Route {
  const arms = armsOf(pieces, turned);
  return computeRoute((tile) => {
    const key = tileKey(tile);
    const piece = pieces.get(key);
    return (
      !arms.has(key) &&
      (piece === undefined || !PIECES[piece.pieceId].blocksDudes)
    );
  });
}

function refuse(refusal: PlacementRefusal): PlacementResult {
  return { ok: false, refusal };
}
