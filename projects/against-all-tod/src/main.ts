import { startRenderer } from "./adapters/renderer/game-renderer";
import { SaveStore } from "./adapters/storage/save-store";
import { loadConfig } from "./config";
import { seedFromUrl, wantsDebugOptions } from "./debug/debug-options";
import { showDebugPanel } from "./debug/debug-panel";
import { newRun } from "./run/run";
import { wantsSwarmScene } from "./debug/swarm-scene";
import { playSwarm } from "./debug/swarm-screen";
import { chooseLogLevel, createConsoleLogger } from "./logger";
import { BOARD_COLUMNS, BOARD_ROWS } from "./maze/board";
import { SHOP_STOCK, FIRST_BUILD_PIECE, RunScreen } from "./run-screen";
import { PORTRAIT_TOUCH_QUERY, showTurnDeviceScreenWhile } from "./ui/device";
import { EndScreen } from "./ui/end-screen";
import { FpsMeter } from "./ui/fps-meter";
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
  if (wantsSwarmScene(window.location.search)) {
    requireElement("hud").textContent =
      "Swarm debug scene: 500 Interns, replayed at 1x";
    playSwarm(
      view,
      new FpsMeter(requireElement("fps")),
      logger,
      config.defaultSeed,
    );
    return;
  }
  const saves = new SaveStore(() => window.localStorage, logger);
  const loaded = saves.load();
  const urlSeed = seedFromUrl(window.location.search);
  const savedRun = loaded.kind === "loaded" ? loaded.run : null;
  // A seed in the URL starts its own Run, unless the saved Run is that seed's (a reload).
  const keepSaved =
    savedRun !== null && (urlSeed === null || urlSeed === savedRun.seed);
  const firstRun = keepSaved
    ? savedRun
    : newRun(urlSeed ?? config.defaultSeed, savedRun?.bestScore ?? 0);
  logger.info(keepSaved ? "Run loaded" : "Run started", {
    seed: firstRun.seed,
    save: loaded.kind,
  });
  const run = new RunScreen(
    view,
    new PieceInfo(requireElement("piece-info")),
    logger,
    firstRun,
    (changed) => {
      saves.save(changed);
    },
  );
  const hud = new Hud(requireElement("hud"), SHOP_STOCK, {
    onChoosePiece: (pieceId) => {
      run.choosePiece(pieceId);
    },
    onChooseDudeKind: (dudeKind) => {
      run.chooseDudeKind(dudeKind);
    },
    onFight: () => {
      run.fight();
    },
    onWatchSpeed: (speed) => {
      run.setWatchSpeed(speed);
    },
    onContinue: () => {
      run.continue();
    },
  });
  const endScreen = new EndScreen(requireElement("end-screen"), () => {
    run.newRun();
  });
  run.begin(hud, endScreen);
  saves.save(firstRun);
  if (loaded.kind === "unreadable") {
    hud.showMessage("Your save couldn't be read, so this is a fresh start.");
  }
  if (wantsDebugOptions(window.location.search)) {
    showDebugPanel(requireElement("debug-panel"), {
      onGiveGold: (side, amount) => {
        run.giveGold(side, amount);
      },
      onJumpToRound: (round) => {
        run.jumpToRound(round);
      },
      onToggleRoute: () => {
        run.toggleRoute();
      },
    });
  }
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
