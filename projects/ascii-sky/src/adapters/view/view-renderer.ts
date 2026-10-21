import {
  PerspectiveCamera,
  type Scene,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import type { Logger } from "../../logger";
import type { BrightnessGrid } from "../../screen/brightness-grid";
import type { CameraPose } from "../../flight/cockpit-camera";
import type { World } from "../../world/world";
import { buildWorldScene, toSceneZ } from "./world-scene";

/** three.js could not start, almost always because the browser has no WebGL. */
export class ViewStartError extends Error {
  override name = "ViewStartError";
}

export interface ViewRenderer {
  /** Renders the World from the camera pose and returns how bright each character cell is. */
  render(pose: CameraPose): BrightnessGrid;
}

export interface ViewSize {
  columns: number;
  rows: number;
  /** Width over height of one character cell. */
  cellAspect: number;
}

/** Vertical field of view: about what a pilot sees through a light aircraft's windscreen. */
const FIELD_OF_VIEW_DEGREES = 40;
const NEAR_METRES = 0.5;
const FAR_METRES = 40_000;

/**
 * Renders the World with three.js into a hidden target with one pixel per character cell
 * (decision 0001), then reads the pixels back as a brightness grid. Nothing is drawn on the page.
 */
export function createViewRenderer(
  world: World,
  size: ViewSize,
  logger: Logger,
): ViewRenderer {
  const renderer = startRenderer();
  const scene: Scene = buildWorldScene(world);
  const target = new WebGLRenderTarget(size.columns, size.rows);
  const camera = new PerspectiveCamera(
    FIELD_OF_VIEW_DEGREES,
    (size.columns * size.cellAspect) / size.rows,
    NEAR_METRES,
    FAR_METRES,
  );
  // Turn to the heading first, then pitch, then roll, like a pilot's head on the Plane.
  camera.rotation.order = "YXZ";
  const pixels = new Uint8Array(size.columns * size.rows * 4);
  renderer.domElement.addEventListener("webglcontextlost", () => {
    logger.error("WebGL context lost; the view will stop updating");
  });
  logger.info("3D view ready", {
    webgl: true,
    grid: `${String(size.columns)}x${String(size.rows)}`,
  });

  return {
    render(pose) {
      camera.position.set(pose.x, pose.height, toSceneZ(pose.y));
      camera.rotation.set(pose.pitch, -pose.heading, -pose.roll);
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.readRenderTargetPixels(
        target,
        0,
        0,
        size.columns,
        size.rows,
        pixels,
      );
      renderer.setRenderTarget(null);
      return toBrightnessGrid(pixels, size);
    },
  };
}

function startRenderer(): WebGLRenderer {
  try {
    return new WebGLRenderer({ antialias: false });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ViewStartError(`three.js could not start WebGL: ${reason}`, {
      cause: error,
    });
  }
}

/** WebGL reads rows bottom-up; the grid is top row first. */
function toBrightnessGrid(pixels: Uint8Array, size: ViewSize): BrightnessGrid {
  const values = new Float32Array(size.columns * size.rows);
  for (let row = 0; row < size.rows; row++) {
    const sourceRow = size.rows - 1 - row;
    for (let column = 0; column < size.columns; column++) {
      const pixel = (sourceRow * size.columns + column) * 4;
      const red = pixels[pixel] ?? 0;
      const green = pixels[pixel + 1] ?? 0;
      const blue = pixels[pixel + 2] ?? 0;
      values[row * size.columns + column] =
        (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
    }
  }
  return { columns: size.columns, rows: size.rows, values };
}
