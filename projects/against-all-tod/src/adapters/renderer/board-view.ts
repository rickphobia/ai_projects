import { Container, Graphics, Sprite } from "pixi.js";
import {
  BOARD_COLUMNS,
  SPAWN_ZONE_COLUMNS,
  allTiles,
  boardRows,
  goalTiles,
  spawnZoneRows,
  tileKind,
} from "../../maze/board";
import { TILE_SIZE, type BoardTextures } from "./board-textures";
import type { GroundDecoration, SurroundPlant } from "./decoration";

/** One colour per side (spec story 101); the Goal and the Spawn zone wear them from the start. */
export const DEFENSE_COLOUR = 0x3d8bfd;
export const ATTACK_COLOUR = 0xff5a36;
/** Marks a tile where the chosen Piece can't go. */
export const REFUSED_COLOUR = 0xff3030;
/** The page's text colour (`--fg`), for words drawn on the Board. */
export const TEXT_COLOUR = 0xe8efe9;
/** The wash over the Board while Brightness is up (`--light-wash`). */
export const LIGHT_WASH_COLOUR = 0xfff3c4;
/** The dark over the Board while Brightness is down (`--dark`). */
export const DARK_COLOUR = 0x000000;

// The art kit's colours (art-pass spec), each matched by the CSS variable in its comment.
/** The two grass shades the Board checkers, close enough to be calm, apart enough to show every tile's edge (`--grass-light`, `--grass-dark`). */
export const GRASS_LIGHT_COLOUR = 0x8ed36b;
export const GRASS_DARK_COLOUR = 0x7cc35a;
/** The ground outside the Board, where the trees grow (`--meadow`). */
export const MEADOW_COLOUR = 0x5f9f48;
/** The thick edge round the Board (`--board-border`). */
export const BOARD_BORDER_COLOUR = 0x9a6a3a;
/** Crates, doors (`--wood`). */
export const WOOD_COLOUR = 0xc98b4e;
/** The Goal's walls (`--office`). */
export const OFFICE_COLOUR = 0xece6d9;
/** Every drawn thing's outline (`--outline`). */
export const OUTLINE_COLOUR = 0x2a2118;
/** Drop shadows, always at `SHADOW_ALPHA` (`--shadow`). */
export const SHADOW_COLOUR = 0x1b2a14;
export const SHADOW_ALPHA = 0.3;
/** Trees, bushes and grass tufts (`--leaf`). */
export const LEAF_COLOUR = 0x3e8c3a;
/** A flower's petals and middle (`--petal`, `--bloom`). */
export const PETAL_COLOUR = 0xfffaf0;
export const BLOOM_COLOUR = 0xffd44d;
/** The Spawn zone carpet under its attack-colour stripes (`--carpet`); pale, so painted Dudes stand out on it. */
export const CARPET_COLOUR = 0xf5c9b3;

/** The art kit's colours by CSS variable name, so a test can keep the page's variables matching. */
export const ART_COLOURS: Readonly<Record<string, number>> = {
  "grass-light": GRASS_LIGHT_COLOUR,
  "grass-dark": GRASS_DARK_COLOUR,
  meadow: MEADOW_COLOUR,
  "board-border": BOARD_BORDER_COLOUR,
  wood: WOOD_COLOUR,
  office: OFFICE_COLOUR,
  outline: OUTLINE_COLOUR,
  shadow: SHADOW_COLOUR,
  leaf: LEAF_COLOUR,
  petal: PETAL_COLOUR,
  bloom: BLOOM_COLOUR,
  carpet: CARPET_COLOUR,
};

/** The world drawn round the Board on every side, in Board pixels: the border and the trees. */
export const BOARD_SURROUND = 48;
const BORDER_WIDTH = 12;
const BORDER_OUTLINE_WIDTH = 3;
const BORDER_INNER_ALPHA = 0.5;
/** The carpet's edge where the Maze begins. */
const CARPET_EDGE_WIDTH = 6;

/** The Board's rectangle in its own pixels at a Window size; `top` is negative once lanes open. */
export interface BoardPixelFrame {
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** The Board and the world drawn round it, in Board pixels: what the camera fits to the window. */
export interface WorldRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export function worldRect(windowSize: number): WorldRect {
  const frame = boardPixelFrame(windowSize);
  return {
    left: -BOARD_SURROUND,
    top: frame.top - BOARD_SURROUND,
    width: frame.width + 2 * BOARD_SURROUND,
    height: frame.height + 2 * BOARD_SURROUND,
  };
}

export function boardPixelFrame(windowSize: number): BoardPixelFrame {
  const { first, last } = boardRows(windowSize);
  return {
    top: first * TILE_SIZE,
    width: BOARD_COLUMNS * TILE_SIZE,
    height: (last - first + 1) * TILE_SIZE,
  };
}

/**
 * The empty Board at a Window size: checkered grass, the Spawn zone's carpet on the left and the
 * Goal's office on the right edge, inside a thick border with trees and bushes round it. Lanes
 * are drawn like the rest of the grass; Spawn zone tiles Window size down has closed are left as
 * meadow outside the border, so the Board's frame visibly loses them.
 */
export function createBoardView(
  textures: BoardTextures,
  windowSize: number,
  plants: readonly SurroundPlant[],
): Container {
  const board = new Container({ label: "board" });
  const world = worldRect(windowSize);
  board.addChild(
    new Graphics()
      .rect(world.left, world.top, world.width, world.height)
      .fill(MEADOW_COLOUR),
  );
  for (const { kind, x, y, scale } of plants) {
    board.addChild(
      new Sprite({
        texture: kind === "tree" ? textures.tree : textures.bush,
        anchor: 0.5,
        position: { x, y },
        scale,
      }),
    );
  }
  for (const tile of allTiles(windowSize)) {
    const kind = tileKind(tile, windowSize);
    if (kind === "closed") continue;
    const checker = (tile.column + tile.row) % 2 === 0;
    const texture =
      kind === "spawn-zone"
        ? textures.carpet
        : checker
          ? textures.grassLight
          : textures.grassDark;
    const sprite = new Sprite(texture);
    sprite.position.set(tile.column * TILE_SIZE, tile.row * TILE_SIZE);
    board.addChild(sprite);
  }
  board.addChild(
    carpetEdge(windowSize),
    border(windowSize),
    goalOffice(textures),
  );
  return board;
}

/** Flowers and tufts on the grass, under the Pieces. Redrawn whole: a Board holds a few dozen. */
export function drawGroundDecorations(
  layer: Container,
  textures: BoardTextures,
  decorations: readonly GroundDecoration[],
): void {
  for (const child of layer.removeChildren()) child.destroy();
  for (const { kind, x, y } of decorations) {
    layer.addChild(
      new Sprite({
        texture: kind === "flower" ? textures.flower : textures.tuft,
        anchor: 0.5,
        position: { x, y },
      }),
    );
  }
}

/** A solid edge in the attack colour where the carpet meets the Maze. */
function carpetEdge(windowSize: number): Graphics {
  const { first, last } = spawnZoneRows(windowSize);
  return new Graphics()
    .rect(
      SPAWN_ZONE_COLUMNS * TILE_SIZE - CARPET_EDGE_WIDTH / 2,
      first * TILE_SIZE,
      CARPET_EDGE_WIDTH,
      (last - first + 1) * TILE_SIZE,
    )
    .fill(ATTACK_COLOUR);
}

/** A thick cartoon border just outside the Board's open tiles, notched where Spawn zone rows are closed. */
function border(windowSize: number): Graphics {
  const outline = boardOutline(windowSize);
  // Outside the edge: a dark band, the border over all but its outer rim, then a soft inner line.
  const strokes = [
    { color: OUTLINE_COLOUR, width: BORDER_WIDTH + BORDER_OUTLINE_WIDTH },
    { color: BOARD_BORDER_COLOUR, width: BORDER_WIDTH },
    {
      color: OUTLINE_COLOUR,
      width: BORDER_OUTLINE_WIDTH,
      alpha: BORDER_INNER_ALPHA,
    },
  ];
  const graphics = new Graphics();
  for (const stroke of strokes) {
    graphics.poly(outline).stroke({ ...stroke, alignment: 0, join: "round" });
  }
  return graphics;
}

/** The open Board's edge, clockwise from the top left, as flat x, y pairs. */
function boardOutline(windowSize: number): number[] {
  const frame = boardPixelFrame(windowSize);
  const top = frame.top;
  const bottom = frame.top + frame.height;
  const right = frame.width;
  const closed = Math.max(0, -windowSize) * TILE_SIZE;
  if (closed === 0) return [0, top, right, top, right, bottom, 0, bottom];
  const zone = SPAWN_ZONE_COLUMNS * TILE_SIZE;
  // prettier-ignore
  return [
    zone, top,
    right, top,
    right, bottom,
    zone, bottom,
    zone, bottom - closed,
    0, bottom - closed,
    0, top + closed,
    zone, top + closed,
  ];
}

/** The Goal: one office building standing over its tiles. */
function goalOffice(textures: BoardTextures): Sprite {
  const goal = goalTiles();
  const column = Math.min(...goal.map((tile) => tile.column));
  const row = Math.min(...goal.map((tile) => tile.row));
  return new Sprite({
    texture: textures.office,
    label: "goal",
    position: { x: column * TILE_SIZE, y: row * TILE_SIZE },
  });
}
