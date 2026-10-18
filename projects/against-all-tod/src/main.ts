import { startRenderer } from "./adapters/renderer/game-renderer";
import { loadConfig } from "./config";
import { BUILD_PIECES, DefenseTurn, FIRST_BUILD_PIECE } from "./defense-turn";
import { chooseLogLevel, createConsoleLogger } from "./logger";
import { BOARD_COLUMNS, BOARD_ROWS } from "./maze/board";
import { PORTRAIT_TOUCH_QUERY, showTurnDeviceScreenWhile } from "./ui/device";
import { Hud } from "./ui/hud";
import { PieceInfo } from "./ui/piece-info";
import { showStartupError } from "./ui/startup-error-screen";

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
  const view = await startRenderer(host, logger, FIRST_BUILD_PIECE);
  // Runs and the seed in the URL come later; until then every battle uses the default seed.
  const turn = new DefenseTurn(
    view,
    new PieceInfo(requireElement("piece-info")),
    logger,
    config.defaultSeed,
  );
  const hud = new Hud(requireElement("hud"), BUILD_PIECES, {
    onChoosePiece: (pieceId) => {
      turn.choosePiece(pieceId);
    },
    onFight: () => {
      turn.fight();
    },
    onWatchSpeed: (speed) => {
      turn.setWatchSpeed(speed);
    },
    onBuildAgain: () => {
      turn.build();
    },
  });
  turn.begin(hud);
  logger.info("Board drawn");
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
