import {
  createScreenOutput,
  type ScreenOutput,
} from "./adapters/screen/screen-output";
import { loadConfig } from "./config";
import { chooseLogLevel, createConsoleLogger } from "./logger";
import { framedScreen, placeholderScreen } from "./screen/framed-screen";
import { SCREEN_COLUMNS, SCREEN_ROWS } from "./screen/screen-size";

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
  screen.show(placeholderScreen());
} catch (error) {
  // No logger yet if config failed, so fall back to one at the default level.
  createConsoleLogger("info").error("start-up failed", { error });
  const reason = error instanceof Error ? error.message : String(error);
  screen.show(framedScreen(["ASCII SKY could not start.", "", reason]));
}
