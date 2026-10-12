import { describe, expect, it } from "vitest";
import type { BrightnessGrid } from "../../src/screen/brightness-grid";
import { CHARACTER_RAMP, rampCharacter } from "../../src/screen/character-ramp";
import {
  CockpitScreenError,
  drawCockpitScreen,
} from "../../src/screen/cockpit-screen";
import {
  PRINTABLE_ASCII,
  SCREEN_COLUMNS,
  SCREEN_ROWS,
  VIEW_COLUMNS,
  VIEW_ROWS,
} from "../../src/screen/screen-size";

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

describe("rampCharacter", () => {
  it("gives a space for the darkest and @ for the brightest", () => {
    expect(rampCharacter(0)).toBe(" ");
    expect(rampCharacter(1)).toBe("@");
  });

  it("maps brightness linearly onto the ramp", () => {
    expect(CHARACTER_RAMP).toBe(" .:-=+*#%@");
    expect(rampCharacter(0.05)).toBe(" ");
    expect(rampCharacter(0.15)).toBe(".");
    expect(rampCharacter(0.55)).toBe("+");
    expect(rampCharacter(0.95)).toBe("@");
  });

  it("clamps values outside 0 to 1 and treats NaN as dark", () => {
    expect(rampCharacter(-3)).toBe(" ");
    expect(rampCharacter(7)).toBe("@");
    expect(rampCharacter(Number.NaN)).toBe(" ");
  });
});

describe("drawCockpitScreen", () => {
  it("is always 45 lines of 120 printable ASCII characters", () => {
    for (const brightness of [0, 0.3, 1]) {
      const lines = drawCockpitScreen(uniformGrid(brightness));
      expect(lines).toHaveLength(SCREEN_ROWS);
      for (const line of lines) {
        expect(line).toHaveLength(SCREEN_COLUMNS);
        expect(line).toMatch(PRINTABLE_ASCII);
      }
    }
  });

  it("shows a uniform brightness grid as its ramp character", () => {
    expect(viewCentre(drawCockpitScreen(uniformGrid(0)))).toBe(" ");
    expect(viewCentre(drawCockpitScreen(uniformGrid(0.45)))).toBe("=");
    expect(viewCentre(drawCockpitScreen(uniformGrid(1)))).toBe("@");
  });

  it("draws the window frame over the edges of the view", () => {
    const lines = drawCockpitScreen(uniformGrid(1));
    expect(lines[0]).toMatch(/^=+$/);
    for (let row = 1; row < VIEW_ROWS; row++) {
      expect(lines[row]?.slice(0, 2)).toBe("||");
      expect(lines[row]?.slice(-2)).toBe("||");
    }
    expect(lines[VIEW_ROWS]).toMatch(/^=+$/);
  });

  it("draws the top of the cowling as a dark nose at the bottom centre of the view", () => {
    const lines = drawCockpitScreen(uniformGrid(1));
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
    expect(() => drawCockpitScreen(tooSmall)).toThrow(CockpitScreenError);
  });
});
