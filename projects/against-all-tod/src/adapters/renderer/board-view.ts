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

/** The Board's rectangle in its own pixels at a Window size; `top` is negative once lanes open. */
export interface BoardPixelFrame {
  readonly top: number;
  readonly width: number;
  readonly height: number;
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
 * The empty Board at a Window size: ground tiles, the Spawn zone on the left and the Goal on the
 * right edge. Lanes are drawn like the rest of the ground; Spawn zone tiles Window size down has
 * closed are left out, so the Board's frame visibly loses them.
 */
export function createBoardView(
  textures: BoardTextures,
  windowSize: number,
): Container {
  const board = new Container({ label: "board" });
  for (const tile of allTiles(windowSize)) {
    const kind = tileKind(tile, windowSize);
    if (kind === "closed") continue;
    const texture = kind === "spawn-zone" ? textures.dirt : textures.grass;
    const sprite = new Sprite(texture);
    sprite.position.set(tile.column * TILE_SIZE, tile.row * TILE_SIZE);
    board.addChild(sprite);
  }
  board.addChild(
    tileGrid(windowSize),
    spawnZoneStripe(windowSize),
    goalMarker(textures),
  );
  return board;
}

/** Faint lines between tiles: the grass tile is seamless, so without them the tiles Pieces snap to can't be seen. */
function tileGrid(windowSize: number): Graphics {
  const frame = boardPixelFrame(windowSize);
  const bottom = frame.top + frame.height;
  const { first, last } = boardRows(windowSize);
  const grid = new Graphics();
  for (let column = 1; column < BOARD_COLUMNS; column++) {
    grid
      .moveTo(column * TILE_SIZE, frame.top)
      .lineTo(column * TILE_SIZE, bottom);
  }
  for (let row = first + 1; row <= last; row++) {
    grid.moveTo(0, row * TILE_SIZE).lineTo(frame.width, row * TILE_SIZE);
  }
  return grid.stroke({ color: 0x000000, alpha: 0.12, width: 2 });
}

/**
 * The Spawn zone's stripe over the rows it has open: a faint wash in the attack colour over its
 * columns, with a solid stripe down the Board's outer edge and a thin one where the Maze begins.
 */
function spawnZoneStripe(windowSize: number): Graphics {
  const { first, last } = spawnZoneRows(windowSize);
  const top = first * TILE_SIZE;
  const width = SPAWN_ZONE_COLUMNS * TILE_SIZE;
  const height = (last - first + 1) * TILE_SIZE;
  return new Graphics()
    .rect(0, top, width, height)
    .fill({ color: ATTACK_COLOUR, alpha: 0.15 })
    .rect(0, top, 6, height)
    .fill({ color: ATTACK_COLOUR, alpha: 0.85 })
    .rect(width - 2, top, 4, height)
    .fill({ color: ATTACK_COLOUR, alpha: 0.6 });
}

/** The Goal's tiles get a stone base each, framed together in the defense colour so they read as one thing. */
function goalMarker(textures: BoardTextures): Container {
  const goal = goalTiles();
  const marker = new Container({ label: "goal" });
  for (const tile of goal) {
    const base = new Sprite(textures.stoneBase);
    base.position.set(tile.column * TILE_SIZE, tile.row * TILE_SIZE);
    marker.addChild(base);
  }
  const columns = goal.map((tile) => tile.column);
  const rows = goal.map((tile) => tile.row);
  const left = Math.min(...columns) * TILE_SIZE;
  const top = Math.min(...rows) * TILE_SIZE;
  const right = (Math.max(...columns) + 1) * TILE_SIZE;
  const bottom = (Math.max(...rows) + 1) * TILE_SIZE;
  const inset = 4;
  marker.addChild(
    new Graphics()
      .roundRect(
        left + inset,
        top + inset,
        right - left - 2 * inset,
        bottom - top - 2 * inset,
        10,
      )
      .stroke({ color: DEFENSE_COLOUR, width: 5 }),
  );
  return marker;
}
