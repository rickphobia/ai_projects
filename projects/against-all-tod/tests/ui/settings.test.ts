import { describe, expect, it } from "vitest";
import { SLIDERS } from "../../src/catalog/tricks";
import { positionLabel, stepHint } from "../../src/ui/settings";

describe("Settings menu labels", () => {
  it("says what a step does, whom it helps and what it costs", () => {
    expect(stepHint("brightness", -1, 20)).toBe(
      `${SLIDERS.brightness.downLabel} · helps attack · 20g`,
    );
    expect(stepHint("game-speed", -1, 50)).toBe(
      `${SLIDERS["game-speed"].downLabel} · helps defense · 50g`,
    );
  });

  it("says when a slider can't go further that way", () => {
    expect(stepHint("brightness", 1, null)).toMatch(/at the end$/);
  });

  it("signs the position", () => {
    expect(positionLabel(-2)).toBe("-2");
    expect(positionLabel(0)).toBe("0");
    expect(positionLabel(1)).toBe("+1");
  });
});
