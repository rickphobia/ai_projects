import { describe, expect, it } from "vitest";
import type { BrightnessGrid } from "../../src/screen/brightness-grid";
import {
  CockpitScreenError,
  drawCockpitScreen,
} from "../../src/screen/cockpit-screen";
import { planeOnRunway } from "../../src/flight/plane";
import { drawInstrumentPanel } from "../../src/screen/instrument-panel";
import { createWorld } from "../../src/world/world";
import { WORLD_LAYOUT } from "../../src/world/world-layout";
import {
  PRINTABLE_ASCII,
  SCREEN_COLUMNS,
  SCREEN_ROWS,
  VIEW_COLUMNS,
  VIEW_ROWS,
} from "../../src/screen/screen-size";

const world = createWorld(WORLD_LAYOUT);
const PANEL = drawInstrumentPanel(planeOnRunway(world), world);

function uniformGrid(brightness: number): BrightnessGrid {
  return {
    columns: VIEW_COLUMNS,
    rows: VIEW_ROWS,
    values: new Float32Array(VIEW_COLUMNS * VIEW_ROWS).fill(brightness),
  };
}

/** A cell in the middle of the view, well clear of the frame and the cowling. */
function viewCentre(lines: readonly string[]): string {
  return lines[Math.floor(VIEW_ROWS / 3)]?.[Math.floor(VIEW_COLUMNS / 2)] ?? "";
}

describe("drawCockpitScreen", () => {
  it("is always 45 lines of 120 printable ASCII characters", () => {
    for (const brightness of [0, 0.3, 1]) {
      const lines = drawCockpitScreen(uniformGrid(brightness), PANEL);
      expect(lines).toHaveLength(SCREEN_ROWS);
      for (const line of lines) {
        expect(line).toHaveLength(SCREEN_COLUMNS);
        expect(line).toMatch(PRINTABLE_ASCII);
      }
    }
  });

  it("shows a uniform brightness grid as its ramp character", () => {
    expect(viewCentre(drawCockpitScreen(uniformGrid(0), PANEL))).toBe(" ");
    expect(viewCentre(drawCockpitScreen(uniformGrid(0.45), PANEL))).toBe("=");
    expect(viewCentre(drawCockpitScreen(uniformGrid(1), PANEL))).toBe("@");
  });

  it("draws the window frame over the edges of the view", () => {
    const lines = drawCockpitScreen(uniformGrid(1), PANEL);
    expect(lines[0]).toMatch(/^=+$/);
    for (let row = 1; row < VIEW_ROWS; row++) {
      expect(lines[row]?.slice(0, 2)).toBe("||");
      expect(lines[row]?.slice(-2)).toBe("||");
    }
    expect(lines[VIEW_ROWS]).toMatch(/^=+$/);
  });

  it("draws the top of the cowling as a dark nose at the bottom centre of the view", () => {
    const lines = drawCockpitScreen(uniformGrid(1), PANEL);
    const centre = Math.floor(SCREEN_COLUMNS / 2);
    const bottomOfView = lines[VIEW_ROWS - 1] ?? "";
    expect(bottomOfView[centre]).toBe(" ");
    // The outline is somewhere above the nose in the centre column.
    const centreColumn = lines.slice(0, VIEW_ROWS).map((line) => line[centre]);
    expect(centreColumn.some((char) => char === "_" || char === "-")).toBe(
      true,
    );
    // The far sides of the bottom row are still the World.
    expect(bottomOfView[4]).toBe("@");
    expect(bottomOfView[SCREEN_COLUMNS - 5]).toBe("@");
  });

  it("refuses a brightness grid of the wrong size", () => {
    const tooSmall: BrightnessGrid = {
      columns: 10,
      rows: 10,
      values: new Float32Array(100),
    };
    expect(() => drawCockpitScreen(tooSmall, PANEL)).toThrow(
      CockpitScreenError,
    );
  });
});
