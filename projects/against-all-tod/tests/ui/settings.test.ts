import { describe, expect, it } from "vitest";
import { SLIDERS } from "../../src/catalog/tricks";
import {
  handlePercent,
  handlePrice,
  positionLabel,
  stepHint,
  undoLabel,
  undoPickHint,
} from "../../src/ui/settings";

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

  it("says what an Undo destroys, or that it is free", () => {
    expect(undoLabel("defense", 40)).toBe(
      "Undo · destroy 40g of your own Pieces",
    );
    expect(undoLabel("attack", 25)).toBe(
      "Undo · destroy 25g of your own Dudes",
    );
    expect(undoLabel("attack", 0)).toBe("Undo · free");
  });

  it("counts what is picked for an Undo against its price", () => {
    expect(undoPickHint("brightness", "defense", 30, 40)).toBe(
      "Brightness Undo: picked 30g of 40g. Tap your Pieces to pick them.",
    );
  });

  it("puts both step prices on the handle chip, with a dash at an end", () => {
    expect(handlePrice(20, 40)).toBe("◀ 20g · 40g ▶");
    expect(handlePrice(40, null)).toBe("◀ 40g · – ▶");
  });

  it("places the handle along the track by position", () => {
    expect(handlePercent(-2)).toBe(0);
    expect(handlePercent(0)).toBe(50);
    expect(handlePercent(1)).toBe(75);
  });
});
