import { Application, Container, Graphics, type Ticker } from "pixi.js";
import type { BattleState } from "../../battle/battle";
import type { ShotEvent } from "../../battle/events";
import type { DudeState } from "../../battle/dudes";
import type { PieceId } from "../../catalog/pieces";
import type { Logger } from "../../logger";
import type { Tile } from "../../maze/board";
import type { Maze } from "../../maze/maze";
import type { SliderPositions } from "../../tricks/tricks";
import {
  listenToPointer,
  tileAtPoint,
  type PaintHandlers,
  type PointerKind,
} from "../input/board-pointer";
import { TILE_SIZE, loadBoardTextures } from "./board-textures";
import {
  BOARD_PIXEL_SIZE,
  DEFENSE_COLOUR,
  createBoardView,
} from "./board-view";
import {
  clampCamera,
  fittedCamera,
  panBy,
  screenToBoard,
  zoomAt,
  type Camera,
  type CameraBounds,
} from "./camera";
import { GoalHealthBar } from "./goal-health-view";
import { drawPieces, pieceView, type Turrets } from "./pieces-view";
import { PlacementCursor } from "./placement-cursor";
import { drawRoute } from "./route-view";
import { TricksView } from "./tricks-view";
import { UnitsView, dudeDisc } from "./units-view";

/** Space kept free around the Board, in screen pixels. */
const VIEW_MARGIN = 16;
/** Closest zoom: a tile is at most this many times its 64 px art. */
const MAX_SCALE = 2.5;
const BACKGROUND_COLOUR = 0x16201a;

export class RendererStartError extends Error {
  override name = "RendererStartError";
}

/** What the rest of the game may ask of the renderer. It draws state; it never changes rules. */
export interface GameView {
  /** Redraws the Pieces and the route preview. */
  showMaze(maze: Maze): void;
  /** Hides the route preview, which would hide Dudes during a battle. */
  showRoute(visible: boolean): void;
  /**
   * Draws the Army standing where it was painted, while building (see `armyDudes`), with the
   * Dudes whose ids are in `dimmed` faded.
   */
  showArmy(dudes: readonly DudeState[], dimmed?: ReadonlySet<number>): void;
  /** The Piece the placement cursor shows. */
  choosePiece(pieceId: PieceId): void;
  /** Marks the tile under the mouse as a place the Piece may or may not go; null hides it. */
  showPlacementCursor(tile: Tile | null, allowed: boolean): void;
  /** Draws a battle's Dudes, shots and turrets; `newShots` are the shots since the last call. */
  showBattle(state: BattleState, newShots: readonly ShotEvent[]): void;
  clearBattle(): void;
  showGoalHealth(health: number, maxHealth: number): void;
  /** Shows where the Settings sliders stand on the Board: the dark, the light, the Game speed. */
  showTricks(sliders: SliderPositions): void;
  /** Calls `onFrame` with the real time since the last frame, until the returned stop is called. */
  everyFrame(onFrame: (elapsedMs: number) => void): () => void;
  listenToBoard(handlers: BoardTileHandlers): void;
}

/** Pointer input after the camera: which tile, not which pixel. Pans and zooms stay inside the renderer. */
export interface BoardTileHandlers {
  /** The tile under the mouse, or null off the Board. Touch never hovers. */
  readonly onHover: (tile: Tile | null) => void;
  readonly onTap: (tile: Tile, kind: PointerKind) => void;
  /** Painting, with every point in tiles of the Board (see `BoardPoint`). */
  readonly paint: PaintHandlers;
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
  const disc = dudeDisc();
  // Drawn at the closest zoom's resolution, so discs stay crisp zoomed in.
  const discTexture = app.renderer.generateTexture({
    target: disc,
    resolution: window.devicePixelRatio * MAX_SCALE,
    antialias: true,
  });
  disc.destroy();
  const units = new UnitsView(textures, discTexture);
  const goalHealth = new GoalHealthBar();
  const tricks = new TricksView();
  let sliders: SliderPositions | null = null;
  const cursor = new PlacementCursor(pieceView(textures, cursorPiece));
  let turrets: Turrets = new Map();
  // The Maze last drawn; a battle's differs once a Wall-breaker destroys a Piece.
  let drawnMaze: Maze | null = null;
  // The route goes over the Pieces so a path squeezing past walls stays readable. The dark goes
  // over the Board and Pieces but under the Dudes, which glow instead.
  board.addChild(
    pieces,
    tricks.view,
    route,
    units.view,
    goalHealth.view,
    cursor.view,
  );
  app.stage.addChild(board);

  const boundsFor = (width: number, height: number): CameraBounds => ({
    view: { width, height },
    content: BOARD_PIXEL_SIZE,
    margin: VIEW_MARGIN,
    maxScale: MAX_SCALE,
  });
  let bounds = boundsFor(app.screen.width, app.screen.height);
  let camera: Camera = fittedCamera(bounds);
  const aim = (next: Camera): void => {
    camera = next;
    board.scale.set(camera.scale);
    board.position.set(camera.x, camera.y);
  };
  aim(camera);
  app.renderer.on("resize", (width: number, height: number) => {
    bounds = boundsFor(width, height);
    aim(clampCamera(camera, bounds));
  });

  const drawTricks = (): void => {
    if (sliders === null || drawnMaze === null) return;
    tricks.show(sliders, drawnMaze);
    units.glow(tricks.dark);
  };

  return {
    showMaze: (maze) => {
      turrets = drawPieces(pieces, textures, maze);
      drawnMaze = maze;
      drawRoute(route, maze.route);
      drawTricks();
    },
    showRoute: (visible) => {
      route.visible = visible;
    },
    showArmy: (dudes, dimmed) => {
      units.showStanding(dudes, dimmed);
    },
    choosePiece: (pieceId) => {
      cursor.setGhost(pieceView(textures, pieceId), DEFENSE_COLOUR);
    },
    showPlacementCursor: (tile, allowed) => {
      cursor.show(tile, allowed);
    },
    showBattle: (state, newShots) => {
      if (state.maze !== drawnMaze) {
        turrets = drawPieces(pieces, textures, state.maze);
        drawnMaze = state.maze;
        drawTricks();
      }
      units.show(state, newShots, turrets);
    },
    clearBattle: () => {
      units.clear();
    },
    showGoalHealth: (health, maxHealth) => {
      goalHealth.show(health, maxHealth);
    },
    showTricks: (positions) => {
      sliders = positions;
      drawTricks();
    },
    everyFrame: (onFrame) => {
      const tick = (ticker: Ticker): void => {
        onFrame(ticker.deltaMS);
      };
      app.ticker.add(tick);
      return () => {
        app.ticker.remove(tick);
      };
    },
    listenToBoard: (handlers) => {
      const tileAt = (point: { x: number; y: number }) =>
        tileAtPoint(screenToBoard(point, camera), TILE_SIZE);
      const boardPointAt = (point: { x: number; y: number }) => {
        const pixels = screenToBoard(point, camera);
        return { x: pixels.x / TILE_SIZE, y: pixels.y / TILE_SIZE };
      };
      const { paint } = handlers;
      listenToPointer(app.canvas, {
        onHover: (point) => {
          handlers.onHover(point === null ? null : tileAt(point));
        },
        onTap: (point, kind) => {
          const tile = tileAt(point);
          if (tile !== null) handlers.onTap(tile, kind);
        },
        onPan: (dx, dy) => {
          aim(panBy(camera, dx, dy, bounds));
        },
        onZoom: (centre, factor) => {
          aim(zoomAt(camera, centre, factor, bounds));
        },
        paint: {
          canPaintAt: (point) => paint.canPaintAt(boardPointAt(point)),
          onPaintStart: (point) => {
            paint.onPaintStart(boardPointAt(point));
          },
          onPaintMove: (point) => {
            paint.onPaintMove(boardPointAt(point));
          },
          onPaintEnd: () => {
            paint.onPaintEnd();
          },
        },
      });
    },
  };
}
