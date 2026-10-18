import { Application, Container, Graphics } from "pixi.js";
import type { PieceId } from "../../catalog/pieces";
import type { Logger } from "../../logger";
import type { Tile } from "../../maze/board";
import type { Maze } from "../../maze/maze";
import {
  listenToBoardPointer,
  type BoardPointerHandlers,
} from "../input/board-pointer";
import { TILE_SIZE, loadBoardTextures } from "./board-textures";
import { BOARD_PIXEL_SIZE, createBoardView } from "./board-view";
import { fitToView } from "./fit-to-view";
import { drawPieces, pieceTexture } from "./pieces-view";
import { PlacementCursor } from "./placement-cursor";
import { drawRoute } from "./route-view";

/** Space kept free around the Board, in screen pixels. */
const VIEW_MARGIN = 16;
const BACKGROUND_COLOUR = 0x16201a;

export class RendererStartError extends Error {
  override name = "RendererStartError";
}

/** What the rest of the game may ask of the renderer. It draws state; it never changes rules. */
export interface GameView {
  /** Redraws the Pieces and the route preview. */
  showMaze(maze: Maze): void;
  /** Marks the tile under the mouse as a place the Piece may or may not go; null hides it. */
  showPlacementCursor(tile: Tile | null, allowed: boolean): void;
  listenToBoard(handlers: BoardPointerHandlers): void;
}

/** Starts PixiJS in `host` and draws the Board, scaled to fit whenever the host resizes. */
export async function startRenderer(
  host: HTMLElement,
  logger: Logger,
  cursorPiece: PieceId,
): Promise<GameView> {
  const app = new Application();
  try {
    await app.init({
      resizeTo: host,
      background: BACKGROUND_COLOUR,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio,
      // WebGL is the widest-supported backend; WebGPU still misbehaves on some phones.
      // PixiJS falls back to WebGPU, then a plain canvas, if WebGL won't start.
      preference: "webgl",
    });
  } catch (error) {
    throw new RendererStartError(
      "This browser could not start WebGL, WebGPU or a canvas to draw the Board.",
      { cause: error },
    );
  }
  host.appendChild(app.canvas);
  logger.info("renderer ready", { renderer: app.renderer.name });
  if (app.renderer.name === "canvas") {
    logger.warn("WebGL is off or unavailable; drawing on a plain canvas", {
      renderer: app.renderer.name,
    });
  }

  const textures = await loadBoardTextures();
  const board = createBoardView(textures);
  const pieces = new Container({ label: "pieces" });
  const route = new Graphics({ label: "route" });
  const cursor = new PlacementCursor(pieceTexture(textures, cursorPiece));
  // The route goes over the Pieces so a path squeezing past walls stays readable.
  board.addChild(pieces, route, cursor.view);
  app.stage.addChild(board);

  const fitBoard = (width: number, height: number): void => {
    const fit = fitToView({ width, height }, BOARD_PIXEL_SIZE, VIEW_MARGIN);
    board.scale.set(fit.scale);
    board.position.set(fit.x, fit.y);
  };
  fitBoard(app.screen.width, app.screen.height);
  app.renderer.on("resize", fitBoard);

  return {
    showMaze: (maze) => {
      drawPieces(pieces, textures, maze);
      drawRoute(route, maze.route);
    },
    showPlacementCursor: (tile, allowed) => {
      cursor.show(tile, allowed);
    },
    listenToBoard: (handlers) => {
      listenToBoardPointer(board, TILE_SIZE, handlers);
    },
  };
}
