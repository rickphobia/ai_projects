import { startRenderer } from "./adapters/renderer/game-renderer";
import { loadConfig } from "./config";
import { chooseLogLevel, createConsoleLogger } from "./logger";
import { BOARD_COLUMNS, BOARD_ROWS } from "./maze/board";
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

  const host = document.getElementById("game");
  if (host === null) {
    throw new Error('index.html has no <div id="game"> to draw the Board in');
  }
  await startRenderer(host, logger);
  logger.info("Board drawn");
}

start().catch((error: unknown) => {
  // No logger yet if config failed, so log at the default level.
  createConsoleLogger("info").error("start-up failed", {
    kind: error instanceof Error ? error.name : "unknown",
    error,
  });
  showStartupError(document, error);
});
