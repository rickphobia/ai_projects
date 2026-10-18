import { PIECES, type PieceId } from "../catalog/pieces";
import {
  isOnBoard,
  spawnLineTiles,
  tileKey,
  tileKind,
  type Tile,
} from "./board";
import { computeRoute, reachesGoal, type Route } from "./route";

/**
 * Everything the defender has placed on the Board, plus the route Dudes take through it.
 * Immutable: placing a Piece returns a new Maze, so a Rewind can keep the old one.
 */
export interface Maze {
  /** Keyed by `tileKey`. */
  readonly pieces: ReadonlyMap<string, PlacedPiece>;
  readonly route: Route;
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
  if (PIECES[pieceId].blocksDudes && !spawnLineReachesGoal(placed.route)) {
    return refuse("seals-goal");
  }
  return { ok: true, maze: placed };
}

/** The Spawn line is all walkable and joined top to bottom, so one of its tiles reaching the Goal means all do. */
function spawnLineReachesGoal(route: Route): boolean {
  return spawnLineTiles().some((tile) => reachesGoal(route, tile));
}

function withPieces(pieces: ReadonlyMap<string, PlacedPiece>): Maze {
  const route = computeRoute((tile) => {
    const piece = pieces.get(tileKey(tile));
    return piece === undefined || !PIECES[piece.pieceId].blocksDudes;
  });
  return { pieces, route };
}

function refuse(refusal: PlacementRefusal): PlacementResult {
  return { ok: false, refusal };
}
