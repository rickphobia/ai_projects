import { Rectangle, type Container, type FederatedPointerEvent } from "pixi.js";
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  isOnBoard,
  type Tile,
} from "../../maze/board";

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface BoardPointerHandlers {
  /** The tile under the mouse, or null once it leaves the Board. */
  readonly onHover: (tile: Tile | null) => void;
  readonly onTap: (tile: Tile) => void;
}

/** The tile under a point in the Board's own pixels, or null off the Board. */
export function tileAtPoint(point: Point, tileSize: number): Tile | null {
  const tile = {
    column: Math.floor(point.x / tileSize),
    row: Math.floor(point.y / tileSize),
  };
  return isOnBoard(tile) ? tile : null;
}

/**
 * Turns clicks and mouse moves on the Board into tiles. Works through the Board's own
 * transform, so it keeps working when ticket 04's camera zooms and pans it.
 */
export function listenToBoardPointer(
  board: Container,
  tileSize: number,
  handlers: BoardPointerHandlers,
): void {
  board.eventMode = "static";
  board.hitArea = new Rectangle(
    0,
    0,
    BOARD_COLUMNS * tileSize,
    BOARD_ROWS * tileSize,
  );
  const tileOf = (event: FederatedPointerEvent) =>
    tileAtPoint(event.getLocalPosition(board), tileSize);

  let hovered: Tile | null = null;
  board.on("pointermove", (event) => {
    const tile = tileOf(event);
    if (sameTile(tile, hovered)) return;
    hovered = tile;
    handlers.onHover(tile);
  });
  board.on("pointerleave", () => {
    hovered = null;
    handlers.onHover(null);
  });
  board.on("pointertap", (event) => {
    const tile = tileOf(event);
    if (tile !== null) handlers.onTap(tile);
  });
}

function sameTile(a: Tile | null, b: Tile | null): boolean {
  return a?.column === b?.column && a?.row === b?.row;
}
