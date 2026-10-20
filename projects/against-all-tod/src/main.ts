import { DEFAULT_ACTUAL_VOLUME } from "./adapters/audio/sound-level";
import { SoundPlayer } from "./adapters/audio/sound-player";
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
import { FIRST_BUILD_PIECE, RunScreen } from "./run-screen";
import { PORTRAIT_TOUCH_QUERY, showTurnDeviceScreenWhile } from "./ui/device";
import { EndScreen } from "./ui/end-screen";
import { FpsMeter } from "./ui/fps-meter";
import { CratePanel } from "./ui/crate";
import { Hud } from "./ui/hud";
import { shopStock } from "./ui/shop";
import { showPauseMenu } from "./ui/pause";
import { PieceInfo } from "./ui/piece-info";
import { RoundReportPanel } from "./ui/report";
import { SettingsMenu } from "./ui/settings";
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
    : newRun(
        urlSeed ?? config.defaultSeed,
        savedRun?.bestScore ?? 0,
        // Only a player with no save at all is on their first Run.
        savedRun === null,
      );
  logger.info(keepSaved ? "Run loaded" : "Run started", {
    seed: firstRun.seed,
    save: loaded.kind,
  });
  const actualVolume = saves.loadActualVolume(DEFAULT_ACTUAL_VOLUME);
  const sounds = new SoundPlayer(logger, actualVolume);
  const run = new RunScreen(
    view,
    new PieceInfo(requireElement("piece-info")),
    logger,
    firstRun,
    (changed) => {
      saves.save(changed);
    },
    sounds,
  );
  const hud = new Hud(requireElement("hud"), () => shopStock(run.bestScore), {
    onChoosePiece: (pieceId) => {
      run.choosePiece(pieceId);
    },
    onChooseDudeKind: (dudeKind) => {
      run.chooseDudeKind(dudeKind);
    },
    onChooseEraser: () => {
      run.chooseEraser();
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
  const cratePanel = new CratePanel(requireElement("crate"), {
    onTake: (index) => {
      run.takeFromCrate(index);
    },
    onReroll: () => {
      run.rerollCrate();
    },
  });
  const report = new RoundReportPanel(requireElement("round-report"));
  const settings = new SettingsMenu(requireElement("settings"), {
    onDrag: (slider, to) => {
      run.dragSlider(slider, to);
    },
    onUndo: (slider) => {
      run.startUndo(slider);
    },
    onPayUndo: () => {
      run.payUndo();
    },
    onCancelUndo: () => {
      run.cancelUndo();
    },
  });
  showPauseMenu(requireElement("pause"), actualVolume, {
    onPausedChange: (paused) => {
      run.setPaused(paused);
    },
    onActualVolume: (volume) => {
      sounds.setActualVolume(volume);
      saves.saveActualVolume(volume);
    },
  });
  run.begin(hud, endScreen, cratePanel, report, settings);
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
