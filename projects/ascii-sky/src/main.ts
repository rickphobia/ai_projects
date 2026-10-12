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
import { drawCockpitScreen } from "./screen/cockpit-screen";
import { framedScreen } from "./screen/framed-screen";
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
  showWorldFromRunway(logger);
} catch (error) {
  // No logger yet if config failed, so fall back to one at the default level.
  createConsoleLogger("info").error("start-up failed", { error });
  showStartFailure("ASCII SKY could not start.", error);
}

/** Nothing moves yet, so one frame from the start of the Runway is the whole game. */
function showWorldFromRunway(logger: Logger): void {
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
  screen.show(drawCockpitScreen(view.render(cockpitCameraOnRunway(world))));
}

function showStartFailure(headline: string, error: unknown): void {
  const reason = error instanceof Error ? error.message : String(error);
  screen.show(framedScreen([headline, "", reason]));
}
