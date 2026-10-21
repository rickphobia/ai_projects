import { describe, expect, it } from "vitest";
import { type Action, NO_CONTROLS } from "../../src/game/controls";
import { advance, type GameState, newGame } from "../../src/game/game";
import { createWorld } from "../../src/world/world";
import { WORLD_LAYOUT } from "../../src/world/world-layout";
import type { BrightnessGrid } from "../../src/screen/brightness-grid";
import { drawGame } from "../../src/screen/game-screen";
import {
  PRINTABLE_ASCII,
  SCREEN_COLUMNS,
  SCREEN_ROWS,
  VIEW_COLUMNS,
  VIEW_ROWS,
} from "../../src/screen/screen-size";

const world = createWorld(WORLD_LAYOUT);
const FRAME = 1 / 60;
const VIEW: BrightnessGrid = {
  columns: VIEW_COLUMNS,
  rows: VIEW_ROWS,
  values: new Float32Array(VIEW_COLUMNS * VIEW_ROWS).fill(1),
};

/** The game after pressing and releasing each set of keys in turn. */
function after(...presses: Action[][]): GameState {
  return presses.reduce(
    (state, actions) =>
      advance(advance(state, new Set(actions), FRAME), NO_CONTROLS, FRAME),
    newGame(world),
  );
}

function expectFullScreen(lines: readonly string[]): void {
  expect(lines).toHaveLength(SCREEN_ROWS);
  for (const line of lines) {
    expect(line).toHaveLength(SCREEN_COLUMNS);
    expect(line).toMatch(PRINTABLE_ASCII);
  }
}

describe("drawGame", () => {
  it("shows the title screen with every key in the title phase", () => {
    const lines = drawGame(newGame(world), VIEW);
    expectFullScreen(lines);
    const text = lines.join("\n");
    expect(text).toContain("Press any key to start");
    for (const key of [
      "Up / Down arrows",
      "Left / Right arrows",
      "A / D",
      "W / S",
      "F ",
      "B ",
      "P / Esc",
      "R ",
    ]) {
      expect(text).toContain(key);
    }
  });

  it("shows the Cockpit view without a banner while flying", () => {
    const lines = drawGame(after(["start"]), VIEW);
    expectFullScreen(lines);
    expect(lines.join("\n")).not.toContain("PAUSED");
    expect(lines[Math.floor(VIEW_ROWS / 3)]?.[VIEW_COLUMNS / 2]).toBe("@");
  });

  it("shows PAUSED over the Cockpit view while paused", () => {
    const lines = drawGame(after(["start"], ["pause"]), VIEW);
    expectFullScreen(lines);
    expect(lines.join("\n")).toContain("PAUSED");
    expect(lines[1]?.[VIEW_COLUMNS / 2]).toBe("@");
  });

  it("drops PAUSED once pause is pressed again", () => {
    const lines = drawGame(after(["start"], ["pause"], ["pause"]), VIEW);
    expect(lines.join("\n")).not.toContain("PAUSED");
  });
});
