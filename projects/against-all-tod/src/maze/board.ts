import { TRICK_RULES } from "../catalog/tricks";

/**
 * The Board's layout: its size, the Spawn zone and the Goal, and how the Window size trick
 * reshapes it. Pure data, no PixiJS, so the maze and battle rules can share it with the renderer.
 */
export const BOARD_COLUMNS = 22;
export const BOARD_ROWS = 14;

/**
 * The Army stands in the left columns and charges right. The Board is that much wider than the
 * Maze, so the zone takes nothing from the defender's 19 columns.
 */
export const SPAWN_ZONE_COLUMNS = 3;

/**
 * Window size up adds this many lanes at most along each of the top and bottom edges; down
 * closes this many Spawn zone rows at most at each end. Lanes get rows above 0 (negative) and
 * below `BOARD_ROWS - 1`, so the tiles of the Board at the neutral Window size never move.
 */
export const MAX_WINDOW_STEPS = TRICK_RULES.stepsEachWay;

/** The top and bottom rows of the largest Board, every lane open. */
export const FIRST_LANE_ROW = -MAX_WINDOW_STEPS;
export const LAST_LANE_ROW = BOARD_ROWS - 1 + MAX_WINDOW_STEPS;

/** Tiles on the largest Board, the length of every array kept by `tileIndex`. */
export const LARGEST_BOARD_TILE_COUNT =
  BOARD_COLUMNS * (LAST_LANE_ROW - FIRST_LANE_ROW + 1);

/** The Board has no single middle row, so the Goal takes the middle two on the right edge. */
const GOAL_COLUMN = BOARD_COLUMNS - 1;
const GOAL_ROWS: readonly number[] = [BOARD_ROWS / 2 - 1, BOARD_ROWS / 2];

export interface Tile {
  readonly column: number;
  readonly row: number;
}

/**
 * "closed" is a Spawn zone tile that Window size down has shut: nothing stands, walks or is
 * built there.
 */
export type TileKind = "open" | "spawn-zone" | "closed" | "goal";

/** The rows from `first` to `last`, both included. */
export interface RowSpan {
  readonly first: number;
  readonly last: number;
}

/** The Board's rows at a Window size: a lane more along each edge per step up. */
export function boardRows(windowSize: number): RowSpan {
  const lanes = Math.max(0, windowSize);
  return { first: -lanes, last: BOARD_ROWS - 1 + lanes };
}

/** The rows the Spawn zone still has at a Window size: a row fewer at each end per step down. */
export function spawnZoneRows(windowSize: number): RowSpan {
  const rows = boardRows(windowSize);
  const closed = Math.max(0, -windowSize);
  return { first: rows.first + closed, last: rows.last - closed };
}

export function tileKind(tile: Tile, windowSize: number): TileKind {
  if (!isOnBoard(tile, windowSize)) {
    throw new RangeError(
      `Tile (${String(tile.column)}, ${String(tile.row)}) is off the Board at Window size ${String(windowSize)}.`,
    );
  }
  if (tile.column < SPAWN_ZONE_COLUMNS) {
    const zone = spawnZoneRows(windowSize);
    return tile.row >= zone.first && tile.row <= zone.last
      ? "spawn-zone"
      : "closed";
  }
  if (tile.column === GOAL_COLUMN && GOAL_ROWS.includes(tile.row)) {
    return "goal";
  }
  return "open";
}

/** Every tile at a Window size, row by row from the top left. */
export function allTiles(windowSize: number): Tile[] {
  const { first, last } = boardRows(windowSize);
  const tiles: Tile[] = [];
  for (let row = first; row <= last; row++) {
    for (let column = 0; column < BOARD_COLUMNS; column++) {
      tiles.push({ column, row });
    }
  }
  return tiles;
}

/** The Goal's tiles, top to bottom. The Goal never moves, whatever the Window size. */
export function goalTiles(): Tile[] {
  return GOAL_ROWS.map((row) => ({ column: GOAL_COLUMN, row }));
}

/** A tile as a string, for keying maps and sets. */
export function tileKey(tile: Tile): string {
  return `${String(tile.column)},${String(tile.row)}`;
}

/** Where a tile of the largest Board sits in arrays of `LARGEST_BOARD_TILE_COUNT`, row by row. */
export function tileIndex(tile: Tile): number {
  return (tile.row - FIRST_LANE_ROW) * BOARD_COLUMNS + tile.column;
}

/** The Spawn zone's tiles at a Window size, row by row from the top left. */
export function spawnZoneTiles(windowSize: number): Tile[] {
  return allTiles(windowSize).filter(
    (tile) => tileKind(tile, windowSize) === "spawn-zone",
  );
}

/** Whether `tile` is an open Spawn zone tile at a Window size; false off the Board. */
export function isInSpawnZone(tile: Tile, windowSize: number): boolean {
  return (
    isOnBoard(tile, windowSize) && tileKind(tile, windowSize) === "spawn-zone"
  );
}

export function isOnBoard(tile: Tile, windowSize: number): boolean {
  const { first, last } = boardRows(windowSize);
  return (
    Number.isInteger(tile.column) &&
    Number.isInteger(tile.row) &&
    tile.column >= 0 &&
    tile.column < BOARD_COLUMNS &&
    tile.row >= first &&
    tile.row <= last
  );
}

/** Whether `tile` is on the Board at some Window size: the bounds for arrays and lookups. */
export function isOnLargestBoard(tile: Tile): boolean {
  return isOnBoard(tile, MAX_WINDOW_STEPS);
}
