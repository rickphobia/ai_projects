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
import { cockpitCamera } from "./flight/cockpit-camera";
import { length } from "./flight/vector";
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
  let state: GameState = newGame(world);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) state = pauseGame(state);
  });

  let lastFrame = performance.now();
  const frame = (now: number): void => {
    const previous = state;
    state = advance(state, keyboard.controls(), (now - lastFrame) / 1000);
    lastFrame = now;
    logChanges(logger, previous, state);
    screen.show(drawGame(state, view.render(cockpitCamera(state.plane))));
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** Phase changes, and lift-off and touchdown with the numbers that help tune the flight model. */
function logChanges(logger: Logger, from: GameState, to: GameState): void {
  if (to.phase !== from.phase) {
    logger.debug("phase changed", { from: from.phase, to: to.phase });
  }
  if (to.flightEnd !== null && from.flightEnd === null) {
    const { ending, stats, crashCause } = to.flightEnd;
    logger.info("flight ended", {
      ending,
      crashCause,
      sinkRate: stats.sinkRate.toFixed(1),
      speed: stats.speed.toFixed(1),
      bankDegrees: ((stats.bank * 180) / Math.PI).toFixed(1),
      centrelineDistance: stats.centrelineDistance.toFixed(1),
    });
  }
  if (to.plane.onGround === from.plane.onGround) return;
  const { position, velocity } = to.plane;
  logger.debug(to.plane.onGround ? "touched down" : "lifted off", {
    speed: length(velocity).toFixed(1),
    sinkRate: (-velocity.z).toFixed(1),
    pitchDegrees: ((to.plane.pitch * 180) / Math.PI).toFixed(1),
    at: `${position.x.toFixed(0)},${position.y.toFixed(0)}`,
  });
}

function showStartFailure(headline: string, error: unknown): void {
  const reason = error instanceof Error ? error.message : String(error);
  screen.show(framedScreen([headline, "", reason]));
}
