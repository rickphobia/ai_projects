import {
  allTiles,
  isOnBoard,
  MAX_WINDOW_STEPS,
  tileKey,
  tileKind,
  type Tile,
} from "../../maze/board";
import type { Maze } from "../../maze/maze";
import { createRng } from "../../rng/rng";
import { TILE_SIZE } from "./board-textures";
import { BOARD_SURROUND, boardPixelFrame } from "./board-view";
import { routeStretches } from "./route-view";

export type GroundDecorationKind = "flower" | "tuft";
export type SurroundPlantKind = "tree" | "bush";

/** A flower or tuft on the grass; `x` and `y` are its centre in Board pixels, inside `tile`. */
export interface GroundDecoration {
  readonly tile: Tile;
  readonly kind: GroundDecorationKind;
  readonly x: number;
  readonly y: number;
}

/** A tree or bush outside the Board's border; `x` and `y` are its centre in Board pixels. */
export interface SurroundPlant {
  readonly kind: SurroundPlantKind;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

/** Share of grass tiles that get a flower or tuft: enough for life, few enough to keep the Board calm. */
const DECORATED_SHARE = 0.16;
const FLOWER_SHARE = 0.45;
/** Decorations keep this share of a tile clear of its edges, so they never spill onto a neighbour. */
const TILE_INSET = 0.22;
/** Distance between plants along the border, and how far each may wander from its spot. */
const PLANT_SPACING = 46;
// Less than half the surround, so a plant's centre never wanders onto the Board.
const PLANT_JITTER = 8;
const TREE_SHARE = 0.55;
const MIN_PLANT_SCALE = 0.8;
const PLANT_SCALE_RANGE = 0.35;
/** Their own streams off the Run's seed, so decoration never shifts a rule's roll or the other's. */
const GROUND_STREAM = 0xdec0_4a7e;
const SURROUND_STREAM = 0x7ee5_b05e;

const LARGEST_BOARD_TILES = allTiles(MAX_WINDOW_STEPS);

/**
 * The grass's flowers and tufts for a Run's seed. Every tile of the largest Board rolls the same
 * way whatever is built, then those on a Piece, the route, the Goal or off the grass are left out,
 * so building only hides decorations and never moves one.
 */
export function groundDecorations(
  seed: number,
  maze: Maze,
): GroundDecoration[] {
  const rng = createRng((seed ^ GROUND_STREAM) >>> 0);
  const covered = coveredTiles(maze);
  const decorations: GroundDecoration[] = [];
  for (const tile of LARGEST_BOARD_TILES) {
    // Four rolls per tile, always, so one tile's outcome never shifts the next one's.
    const chance = rng();
    const kindRoll = rng();
    const across = rng();
    const down = rng();
    if (chance >= DECORATED_SHARE) continue;
    if (!isOnBoard(tile, maze.windowSize)) continue;
    if (tileKind(tile, maze.windowSize) !== "open") continue;
    if (covered.has(tileKey(tile))) continue;
    decorations.push({
      tile,
      kind: kindRoll < FLOWER_SHARE ? "flower" : "tuft",
      x: (tile.column + insetShare(across)) * TILE_SIZE,
      y: (tile.row + insetShare(down)) * TILE_SIZE,
    });
  }
  return decorations;
}

/** Trees and bushes in a ring around the Board at a Window size, from a Run's seed. */
export function surroundPlants(
  seed: number,
  windowSize: number,
): SurroundPlant[] {
  const rng = createRng((seed ^ SURROUND_STREAM) >>> 0);
  const frame = boardPixelFrame(windowSize);
  const ring = BOARD_SURROUND / 2;
  const left = -ring;
  const right = frame.width + ring;
  const top = frame.top - ring;
  const bottom = frame.top + frame.height + ring;
  const spots: { x: number; y: number }[] = [];
  for (const x of evenSpots(left, right)) {
    spots.push({ x, y: top }, { x, y: bottom });
  }
  for (const y of evenSpots(top, bottom).slice(1, -1)) {
    spots.push({ x: left, y }, { x: right, y });
  }
  return spots.map(({ x, y }) => {
    const kind: SurroundPlantKind = rng() < TREE_SHARE ? "tree" : "bush";
    const jitterX = (rng() * 2 - 1) * PLANT_JITTER;
    const jitterY = (rng() * 2 - 1) * PLANT_JITTER;
    const scale = MIN_PLANT_SCALE + rng() * PLANT_SCALE_RANGE;
    return {
      kind,
      x: x + jitterX,
      y: y + jitterY,
      scale,
    };
  });
}

/** Tiles a decoration would hide under or clash with: Pieces and the route preview. */
function coveredTiles(maze: Maze): Set<string> {
  const covered = new Set(maze.pieces.keys());
  for (const { from, to } of routeStretches(maze.route, maze.windowSize)) {
    covered.add(tileKey(from)).add(tileKey(to));
  }
  return covered;
}

/** Spots from `start` to `end`, both included, about `PLANT_SPACING` apart, so every corner gets a plant. */
function evenSpots(start: number, end: number): number[] {
  const gaps = Math.max(1, Math.round((end - start) / PLANT_SPACING));
  return Array.from(
    { length: gaps + 1 },
    (_, index) => start + ((end - start) * index) / gaps,
  );
}

function insetShare(roll: number): number {
  return TILE_INSET + roll * (1 - 2 * TILE_INSET);
}
