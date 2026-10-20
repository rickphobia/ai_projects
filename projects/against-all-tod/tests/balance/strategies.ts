import { nextStroke } from "../../src/battle/army";
import type { BoardPoint } from "../../src/battle/events";
import { paintRadius, type DudeKindId } from "../../src/catalog/dudes";
import type { PieceId } from "../../src/catalog/pieces";
import {
  BOARD_ROWS,
  SPAWN_ZONE_COLUMNS,
  type Tile,
} from "../../src/maze/board";
import {
  checkPaint,
  checkPiece,
  giftLeft,
  type RunState,
} from "../../src/run/run";
import { act, type Strategies } from "./play-run";

/**
 * The simple fixed strategies the balance check plays: what a new player does without thinking.
 * Both take every crate pick (the first item each time), place what it gives for free, then spend
 * the turn's gold on the cheapest thing the shop sells that does the job.
 */

/** Columns of the basic Maze's Sniper Nests, nearest the Goal first. */
const NEST_COLUMNS = [17, 14, 11, 8, 5, 19];
/** Rows either side of the Goal's (6 and 7), working outward. */
const NEST_ROW_PAIRS = [
  [5, 8],
  [3, 10],
  [1, 12],
  [4, 9],
  [2, 11],
  [0, 13],
];

/** Where the basic Maze puts its Pieces, in order: a grid of towers off the Goal's row. */
const MAZE_TILES: readonly Tile[] = NEST_ROW_PAIRS.flatMap((rows) =>
  NEST_COLUMNS.flatMap((column) => rows.map((row) => ({ column, row }))),
);

/**
 * Spots for painting `dudeKind`, front of the Spawn zone first: a hexagonal grid just wider than
 * the room each Dude keeps, the tightest a full zone can be packed.
 */
function paintSpots(dudeKind: DudeKindId): BoardPoint[] {
  const apart = 2 * paintRadius(dudeKind) + 0.001;
  const rowGap = (apart * Math.sqrt(3)) / 2;
  const spots: BoardPoint[] = [];
  for (let row = 0; (row + 1) * rowGap < BOARD_ROWS; row++) {
    const shift = row % 2 === 0 ? 0 : apart / 2;
    for (let x = apart / 2 + shift; x < SPAWN_ZONE_COLUMNS; x += apart) {
      spots.push({ x, y: rowGap / 2 + row * rowGap });
    }
  }
  return spots.sort((a, b) => b.x - a.x);
}

/** Takes the crate's first item until its picks run out. */
function takeCrate(state: RunState): RunState {
  let current = state;
  while (current.crate !== null) {
    current = act(current, { type: "take-from-crate", index: 0 });
  }
  return current;
}

/** Places `pieceId` on the first Maze tile that takes it; null when none does. */
function placeOnFirstFit(state: RunState, pieceId: PieceId): RunState | null {
  const tile = MAZE_TILES.find((at) => checkPiece(state, at, pieceId) === null);
  return tile === undefined
    ? null
    : act(state, { type: "place-piece", tile, pieceId });
}

/**
 * Paints Dudes of `dudeKind` front to back, one Stroke, while the Run accepts them: until the
 * gift is used up when `giftOnly`, else until gold or room runs out.
 */
function paintAll(
  state: RunState,
  dudeKind: DudeKindId,
  giftOnly: boolean,
): RunState {
  const stroke = nextStroke(state.army);
  let current = state;
  for (const at of paintSpots(dudeKind)) {
    if (giftOnly && giftLeft(current, dudeKind) === 0) break;
    if (checkPaint(current, at, dudeKind) !== null) continue;
    current = act(current, { type: "paint-dude", dudeKind, at, stroke });
  }
  return current;
}

/** Basic Maze: free Pieces first, then as many Sniper Nests as Defense gold buys. */
function basicMaze(state: RunState): RunState {
  let current = takeCrate(state);
  for (const item of current.freeItems) {
    if (item.kind === "piece") {
      current = placeOnFirstFit(current, item.id) ?? current;
    }
  }
  for (;;) {
    const placed = placeOnFirstFit(current, "sniper-nest");
    if (placed === null) return current;
    current = placed;
  }
}

/** Basic Army: the crate's gift Dudes first, then as many Interns as Attack gold buys. */
function basicArmy(state: RunState): RunState {
  let current = takeCrate(state);
  for (const item of current.freeItems) {
    if (item.kind === "gift") current = paintAll(current, item.id, true);
  }
  return paintAll(current, "intern", false);
}

export const BASIC: Strategies = { defense: basicMaze, attack: basicArmy };
