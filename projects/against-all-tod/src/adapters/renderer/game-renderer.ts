import { Application } from "pixi.js";
import type { Logger } from "../../logger";
import { loadBoardTextures } from "./board-textures";
import { BOARD_PIXEL_SIZE, createBoardView } from "./board-view";
import { fitToView } from "./fit-to-view";

/** Space kept free around the Board, in screen pixels. */
const VIEW_MARGIN = 16;
const BACKGROUND_COLOUR = 0x16201a;

export class RendererStartError extends Error {
  override name = "RendererStartError";
}

/** Starts PixiJS in `host` and draws the empty Board, scaled to fit whenever the host resizes. */
export async function startRenderer(
  host: HTMLElement,
  logger: Logger,
): Promise<Application> {
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

  const board = createBoardView(await loadBoardTextures());
  app.stage.addChild(board);

  const fitBoard = (width: number, height: number): void => {
    const fit = fitToView({ width, height }, BOARD_PIXEL_SIZE, VIEW_MARGIN);
    board.scale.set(fit.scale);
    board.position.set(fit.x, fit.y);
  };
  fitBoard(app.screen.width, app.screen.height);
  app.renderer.on("resize", fitBoard);
  return app;
}
