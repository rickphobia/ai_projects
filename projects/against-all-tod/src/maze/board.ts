/**
 * The Board's fixed layout: its size, the Spawn line and the Goal. Pure data, no PixiJS,
 * so the maze and battle rules can share it with the renderer.
 */
export const BOARD_COLUMNS = 20;
export const BOARD_ROWS = 14;

/** Dudes enter on the left column and travel right. */
const SPAWN_LINE_COLUMN = 0;

/** The Board has no single middle row, so the Goal takes the middle two on the right edge. */
const GOAL_COLUMN = BOARD_COLUMNS - 1;
const GOAL_ROWS: readonly number[] = [BOARD_ROWS / 2 - 1, BOARD_ROWS / 2];

export interface Tile {
  readonly column: number;
  readonly row: number;
}

export type TileKind = "open" | "spawn-line" | "goal";

export function tileKind(tile: Tile): TileKind {
  if (!isOnBoard(tile)) {
    throw new RangeError(
      `Tile (${String(tile.column)}, ${String(tile.row)}) is off the Board.`,
    );
  }
  if (tile.column === SPAWN_LINE_COLUMN) return "spawn-line";
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

/** The Spawn line's tiles, top to bottom. */
export function spawnLineTiles(): Tile[] {
  return allTiles().filter((tile) => tileKind(tile) === "spawn-line");
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
