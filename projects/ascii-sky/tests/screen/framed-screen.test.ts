import { describe, expect, it } from "vitest";
import {
  framedScreen,
  placeholderScreen,
} from "../../src/screen/framed-screen";
import {
  PRINTABLE_ASCII,
  SCREEN_COLUMNS,
  SCREEN_ROWS,
} from "../../src/screen/screen-size";

function expectFullScreen(lines: readonly string[]): void {
  expect(lines).toHaveLength(SCREEN_ROWS);
  for (const line of lines) {
    expect(line).toHaveLength(SCREEN_COLUMNS);
    expect(line).toMatch(PRINTABLE_ASCII);
  }
}

describe("placeholderScreen", () => {
  it("is 45 lines of 120 printable ASCII characters", () => {
    expectFullScreen(placeholderScreen());
  });

  it("names the game", () => {
    expect(placeholderScreen().join("\n")).toContain("A S C I I   S K Y");
  });
});

describe("framedScreen", () => {
  it("wraps a message too long for one line instead of cutting it off", () => {
    const words = Array.from({ length: 40 }, (_, i) => `word${String(i)}`);
    const lines = framedScreen([words.join(" ")]);
    expectFullScreen(lines);
    const shown = lines.join(" ").replace(/[|+-]/g, " ");
    for (const word of words) expect(shown).toContain(` ${word} `);
  });

  it("replaces characters outside printable ASCII", () => {
    const lines = framedScreen(["café – ok"]);
    expectFullScreen(lines);
    expect(lines.join("\n")).toContain("caf? ? ok");
  });
});
