import {
  createScreenOutput,
  type ScreenOutput,
} from "./adapters/screen/screen-output";
import {
  createViewRenderer,
  type ViewRenderer,
  ViewStartError,
} from "./adapters/view/view-renderer";
import { loadConfig } from "./config";
import { chooseLogLevel, createConsoleLogger, type Logger } from "./logger";
import { createKeyboard, hasKeyboard } from "./adapters/keyboard/keyboard";
import { advance, type GameState, newGame, pauseGame } from "./game/game";
import { framedScreen } from "./screen/framed-screen";
import { drawGame } from "./screen/game-screen";
import {
  CELL_ASPECT,
  SCREEN_COLUMNS,
  SCREEN_ROWS,
  VIEW_COLUMNS,
  VIEW_ROWS,
} from "./screen/screen-size";
import { cockpitCameraOnRunway } from "./world/cockpit-camera";
import { createWorld } from "./world/world";
import { WORLD_LAYOUT } from "./world/world-layout";

const pre = document.getElementById("screen");
if (!(pre instanceof HTMLPreElement)) {
  throw new Error('index.html has no <pre id="screen"> to draw the Screen in');
}
const screen: ScreenOutput = createScreenOutput(pre, window);

try {
  const config = loadConfig(import.meta.env);
  const logger = createConsoleLogger(
    chooseLogLevel(config.debug, window.location.search),
  );
  logger.info("starting", {
    buildVersion: config.buildVersion,
    screen: `${String(SCREEN_COLUMNS)}x${String(SCREEN_ROWS)}`,
  });
  if (hasKeyboard(window)) {
    runGame(logger);
  } else {
    logger.info("no keyboard found, not starting");
    screen.show(
      framedScreen([
        "ASCII SKY needs a keyboard.",
        "",
        "Open this page on a computer to fly.",
      ]),
    );
  }
} catch (error) {
  // No logger yet if config failed, so fall back to one at the default level.
  createConsoleLogger("info").error("start-up failed", { error });
  showStartFailure("ASCII SKY could not start.", error);
}

function runGame(logger: Logger): void {
  const world = createWorld(WORLD_LAYOUT);
  let view: ViewRenderer;
  try {
    view = createViewRenderer(
      world,
      { columns: VIEW_COLUMNS, rows: VIEW_ROWS, cellAspect: CELL_ASPECT },
      logger,
    );
  } catch (error) {
    // Anything else is a bug, not a missing WebGL; let the general start-up failure report it.
    if (!(error instanceof ViewStartError)) throw error;
    logger.error("3D view could not start", { webgl: false, error });
    showStartFailure(
      "ASCII SKY needs WebGL to draw the World, and this browser could not start it.",
      error,
    );
    return;
  }

  const keyboard = createKeyboard(window);
  let state: GameState = newGame();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) state = pauseGame(state);
  });

  let lastFrame = performance.now();
  const frame = (now: number): void => {
    const previousPhase = state.phase;
    state = advance(state, keyboard.controls(), (now - lastFrame) / 1000);
    lastFrame = now;
    if (state.phase !== previousPhase) {
      logger.debug("phase changed", { from: previousPhase, to: state.phase });
    }
    // Nothing moves yet, so the camera stays at the start of the Runway.
    screen.show(drawGame(state, view.render(cockpitCameraOnRunway(world))));
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function showStartFailure(headline: string, error: unknown): void {
  const reason = error instanceof Error ? error.message : String(error);
  screen.show(framedScreen([headline, "", reason]));
}
