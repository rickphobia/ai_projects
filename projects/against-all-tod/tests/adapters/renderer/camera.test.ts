import { describe, expect, it } from "vitest";
import { tileAtPoint } from "../../../src/adapters/input/board-pointer";
import {
  clampCamera,
  fittedCamera,
  panBy,
  screenToBoard,
  shakeOffset,
  SHAKE_MS,
  zoomAt,
  type Camera,
  type CameraBounds,
} from "../../../src/adapters/renderer/camera";

const TILE = 64;
// The 20×14 Board in a view exactly its size at scale 1.
const BOUNDS: CameraBounds = {
  view: { width: 1280, height: 896 },
  content: { width: 1280, height: 896 },
  margin: 0,
  maxScale: 4,
};

const tileOnScreen = (x: number, y: number, camera: Camera) =>
  tileAtPoint(screenToBoard({ x, y }, camera), TILE, 0);

describe("screen to tile", () => {
  it("matches the Board's pixels when the camera is at rest", () => {
    const camera = fittedCamera(BOUNDS);
    expect(camera).toEqual({ scale: 1, x: 0, y: 0 });
    expect(tileOnScreen(70, 10, camera)).toEqual({ column: 1, row: 0 });
  });

  it("accounts for zoom", () => {
    const camera = { scale: 2, x: 0, y: 0 };
    expect(tileOnScreen(130, 260, camera)).toEqual({ column: 1, row: 2 });
  });

  it("accounts for pan at any zoom", () => {
    expect(tileOnScreen(10, 10, { scale: 2, x: -640, y: -128 })).toEqual({
      column: 5,
      row: 1,
    });
    expect(tileOnScreen(100, 100, { scale: 0.5, x: 100, y: 100 })).toEqual({
      column: 0,
      row: 0,
    });
  });

  it("is null for a screen point off the Board", () => {
    expect(tileOnScreen(50, 50, { scale: 0.5, x: 100, y: 100 })).toBeNull();
  });
});

describe("zoomAt", () => {
  it("keeps the Board pixel under the cursor in place", () => {
    const anchor = { x: 400, y: 300 };
    const before = screenToBoard(anchor, fittedCamera(BOUNDS));
    const zoomed = zoomAt(fittedCamera(BOUNDS), anchor, 2, BOUNDS);
    expect(zoomed.scale).toBe(2);
    expect(screenToBoard(anchor, zoomed)).toEqual(before);
  });

  it("stops at the fitted scale and at the max scale", () => {
    const camera = fittedCamera(BOUNDS);
    expect(zoomAt(camera, { x: 0, y: 0 }, 0.1, BOUNDS).scale).toBe(1);
    expect(zoomAt(camera, { x: 0, y: 0 }, 100, BOUNDS).scale).toBe(4);
  });
});

describe("clamping keeps the Board on screen", () => {
  it("won't pan a zoomed Board's edge into the view", () => {
    const zoomed = { scale: 2, x: 0, y: 0 };
    expect(panBy(zoomed, 500, 500, BOUNDS)).toEqual(zoomed);
    expect(panBy(zoomed, -5000, -5000, BOUNDS)).toEqual({
      scale: 2,
      x: 1280 - 2560,
      y: 896 - 1792,
    });
  });

  it("centres a Board smaller than the view", () => {
    const wide: CameraBounds = {
      ...BOUNDS,
      view: { width: 2000, height: 896 },
    };
    expect(clampCamera({ scale: 1, x: -300, y: 40 }, wide)).toEqual({
      scale: 1,
      x: 360,
      y: 0,
    });
  });
});

describe("screen shake", () => {
  it("wobbles no further than its strength and is over in under half a second", () => {
    expect(SHAKE_MS).toBeLessThan(500);
    for (let ageMs = 0; ageMs < SHAKE_MS; ageMs += 7) {
      const { x, y } = shakeOffset(ageMs, 10);
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(10);
    }
    expect(shakeOffset(SHAKE_MS, 10)).toEqual({ x: 0, y: 0 });
    expect(shakeOffset(SHAKE_MS + 1000, 10)).toEqual({ x: 0, y: 0 });
  });

  it("dies away as it ages", () => {
    const biggest = (from: number, to: number) => {
      let most = 0;
      for (let ageMs = from; ageMs < to; ageMs++) {
        const { x, y } = shakeOffset(ageMs, 10);
        most = Math.max(most, Math.hypot(x, y));
      }
      return most;
    };
    expect(biggest(SHAKE_MS * 0.75, SHAKE_MS)).toBeLessThan(
      biggest(0, SHAKE_MS * 0.25),
    );
  });
});
