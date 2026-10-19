/**
 * The Board's fixed layout: its size, the Spawn zone and the Goal. Pure data, no PixiJS,
 * so the maze and battle rules can share it with the renderer.
 */
export const BOARD_COLUMNS = 22;
export const BOARD_ROWS = 14;

/**
 * The Army stands in the left columns and charges right. The Board is that much wider than the
 * Maze, so the zone takes nothing from the defender's 19 columns.
 */
export const SPAWN_ZONE_COLUMNS = 3;

/** The Board has no single middle row, so the Goal takes the middle two on the right edge. */
const GOAL_COLUMN = BOARD_COLUMNS - 1;
const GOAL_ROWS: readonly number[] = [BOARD_ROWS / 2 - 1, BOARD_ROWS / 2];

export interface Tile {
  readonly column: number;
  readonly row: number;
}

export type TileKind = "open" | "spawn-zone" | "goal";

export function tileKind(tile: Tile): TileKind {
  if (!isOnBoard(tile)) {
    throw new RangeError(
      `Tile (${String(tile.column)}, ${String(tile.row)}) is off the Board.`,
    );
  }
  if (tile.column < SPAWN_ZONE_COLUMNS) return "spawn-zone";
  if (tile.column === GOAL_COLUMN && GOAL_ROWS.includes(tile.row)) {
    return "goal";
  }
  return "open";
}

/** Every tile, row by row from the top left. */
export function allTiles(): Tile[] {
  const tiles: Tile[] = [];
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let column = 0; column < BOARD_COLUMNS; column++) {
      tiles.push({ column, row });
    }
  }
  return tiles;
}

/** The Goal's tiles, top to bottom. */
export function goalTiles(): Tile[] {
  return allTiles().filter((tile) => tileKind(tile) === "goal");
}

/** A tile as a string, for keying maps and sets. */
export function tileKey(tile: Tile): string {
  return `${String(tile.column)},${String(tile.row)}`;
}

/** The Spawn zone's tiles, row by row from the top left. */
export function spawnZoneTiles(): Tile[] {
  return allTiles().filter((tile) => tileKind(tile) === "spawn-zone");
}

/** Whether `tile` is a Spawn zone tile; false off the Board. */
export function isInSpawnZone(tile: Tile): boolean {
  return isOnBoard(tile) && tileKind(tile) === "spawn-zone";
}

export function isOnBoard(tile: Tile): boolean {
  return (
    Number.isInteger(tile.column) &&
    Number.isInteger(tile.row) &&
    tile.column >= 0 &&
    tile.column < BOARD_COLUMNS &&
    tile.row >= 0 &&
    tile.row < BOARD_ROWS
  );
}
