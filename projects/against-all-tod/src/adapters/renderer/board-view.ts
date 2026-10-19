import { Container, Graphics, Sprite } from "pixi.js";
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  allTiles,
  tileKind,
  type TileKind,
} from "../../maze/board";
import { TILE_SIZE, type BoardTextures } from "./board-textures";

/** One colour per side (spec story 101); the Goal and the Spawn line wear them from the start. */
export const DEFENSE_COLOUR = 0x3d8bfd;
export const ATTACK_COLOUR = 0xff5a36;
/** Marks a tile where the chosen Piece can't go. */
export const REFUSED_COLOUR = 0xff3030;
/** The page's text colour (`--fg`), for words drawn on the Board. */
export const TEXT_COLOUR = 0xe8efe9;
/** The wash over the Board while Brightness is up (`--light-wash`). */
export const LIGHT_WASH_COLOUR = 0xfff3c4;

export const BOARD_PIXEL_SIZE = {
  width: BOARD_COLUMNS * TILE_SIZE,
  height: BOARD_ROWS * TILE_SIZE,
} as const;

/** The empty Board: ground tiles, the Spawn line on the left and the Goal on the right edge. */
export function createBoardView(textures: BoardTextures): Container {
  const board = new Container({ label: "board" });
  for (const tile of allTiles()) {
    const sprite = new Sprite(groundTexture(textures, tileKind(tile)));
    sprite.position.set(tile.column * TILE_SIZE, tile.row * TILE_SIZE);
    board.addChild(sprite);
  }
  board.addChild(tileGrid(), spawnLineEdge(), goalMarker(textures));
  return board;
}

/** Faint lines between tiles: the grass tile is seamless, so without them the tiles Pieces snap to can't be seen. */
function tileGrid(): Graphics {
  const grid = new Graphics();
  for (let column = 1; column < BOARD_COLUMNS; column++) {
    grid
      .moveTo(column * TILE_SIZE, 0)
      .lineTo(column * TILE_SIZE, BOARD_PIXEL_SIZE.height);
  }
  for (let row = 1; row < BOARD_ROWS; row++) {
    grid
      .moveTo(0, row * TILE_SIZE)
      .lineTo(BOARD_PIXEL_SIZE.width, row * TILE_SIZE);
  }
  return grid.stroke({ color: 0x000000, alpha: 0.12, width: 2 });
}

function groundTexture(textures: BoardTextures, kind: TileKind) {
  return kind === "spawn-line" ? textures.dirt : textures.grass;
}

/** A stripe in the attack colour down the Spawn line's outer edge. */
function spawnLineEdge(): Graphics {
  return new Graphics()
    .rect(0, 0, 6, BOARD_PIXEL_SIZE.height)
    .fill({ color: ATTACK_COLOUR, alpha: 0.85 });
}

/** The Goal's tiles get a stone base each, framed together in the defense colour so they read as one thing. */
function goalMarker(textures: BoardTextures): Container {
  const goalTiles = allTiles().filter((tile) => tileKind(tile) === "goal");
  const marker = new Container({ label: "goal" });
  for (const tile of goalTiles) {
    const base = new Sprite(textures.stoneBase);
    base.position.set(tile.column * TILE_SIZE, tile.row * TILE_SIZE);
    marker.addChild(base);
  }
  const columns = goalTiles.map((tile) => tile.column);
  const rows = goalTiles.map((tile) => tile.row);
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
