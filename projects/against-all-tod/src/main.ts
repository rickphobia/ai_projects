import {
  startRenderer,
  type GameView,
} from "./adapters/renderer/game-renderer";
import { PIECES } from "./catalog/pieces";
import { loadConfig } from "./config";
import { chooseLogLevel, createConsoleLogger, type Logger } from "./logger";
import { BOARD_COLUMNS, BOARD_ROWS, type Tile } from "./maze/board";
import {
  checkPlacement,
  emptyMaze,
  pieceAt,
  placePiece,
  type Maze,
} from "./maze/maze";
import { PORTRAIT_TOUCH_QUERY, showTurnDeviceScreenWhile } from "./ui/device";
import { Hud } from "./ui/hud";
import { PieceInfo } from "./ui/piece-info";
import { showStartupError } from "./ui/startup-error-screen";

/** The only Piece until Draft Crates and the shop arrive. */
const BUILD_PIECE = PIECES["crate-wall"];

async function start(): Promise<void> {
  const config = loadConfig(import.meta.env);
  const logger = createConsoleLogger(
    chooseLogLevel(config.debug, window.location.search),
  );
  logger.info("starting", {
    buildVersion: config.buildVersion,
    board: `${String(BOARD_COLUMNS)}x${String(BOARD_ROWS)}`,
  });
  logger.debug("config", { ...config });

  showTurnDeviceScreenWhile(
    requireElement("turn-device"),
    window.matchMedia(PORTRAIT_TOUCH_QUERY),
  );
  const host = requireElement("game");
  const view = await startRenderer(host, logger, BUILD_PIECE.id);
  const hud = new Hud(
    requireElement("hud"),
    "Defense turn",
    `Tap a tile to place a ${BUILD_PIECE.name}, or a Piece to see what it does. Drag to pan; pinch or scroll to zoom.`,
  );
  buildTheMaze(view, hud, new PieceInfo(requireElement("piece-info")), logger);
  logger.info("Board drawn");
}

/** Wires clicks to the maze rules until the run module owns the Round. */
function buildTheMaze(
  view: GameView,
  hud: Hud,
  pieceInfo: PieceInfo,
  logger: Logger,
): void {
  let maze = emptyMaze();
  view.showMaze(maze);
  view.listenToBoard({
    onHover: (tile) => {
      view.showPlacementCursor(
        tile,
        tile !== null && checkPlacement(maze, tile, BUILD_PIECE.id) === null,
      );
      if (!showPieceInfo(pieceInfo, maze, tile)) pieceInfo.hide();
    },
    onTap: (tile, kind) => {
      // Tapping a Piece asks what it does; on touch that is the only way to ask.
      if (showPieceInfo(pieceInfo, maze, tile)) return;
      pieceInfo.hide();
      const result = placePiece(maze, tile, BUILD_PIECE.id);
      if (!result.ok) {
        logger.info("placement refused", { tile, refusal: result.refusal });
        hud.showRefusal(result.refusal);
        return;
      }
      maze = result.maze;
      logger.debug("Piece placed", { tile, piece: BUILD_PIECE.id });
      view.showMaze(maze);
      // The tile under the mouse is now taken; a finger has lifted, so there is no cursor.
      if (kind === "mouse") view.showPlacementCursor(tile, false);
    },
  });
}

/** Shows the Piece on `tile` in the info panel; false if there is none. */
function showPieceInfo(
  info: PieceInfo,
  maze: Maze,
  tile: Tile | null,
): boolean {
  const id = tile === null ? undefined : pieceAt(maze, tile);
  if (id === undefined) return false;
  info.show(PIECES[id]);
  return true;
}

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`index.html has no <div id="${id}">`);
  }
  return element;
}

start().catch((error: unknown) => {
  // No logger yet if config failed, so log at the default level.
  createConsoleLogger("info").error("start-up failed", {
    kind: error instanceof Error ? error.name : "unknown",
    error,
  });
  showStartupError(document, error);
});
