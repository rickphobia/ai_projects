import { describe, expect, it } from "vitest";
import { SLIDERS, TRICK_RULES } from "../../src/catalog/tricks";
import {
  dragPrice,
  NEUTRAL_SLIDERS,
  sideHelped,
  slidersAfter,
  slidersAt,
} from "../../src/tricks/tricks";

const STEP = SLIDERS.brightness.stepPrice;
const TOWARD = TRICK_RULES.towardMiddleMultiplier;
const MID = TRICK_RULES.midBattleMultiplier;

describe("which side a slider direction helps", () => {
  it("Brightness down and Game speed up help attack; the other ways help defense", () => {
    expect(sideHelped("brightness", -1)).toBe("attack");
    expect(sideHelped("brightness", 1)).toBe("defense");
    expect(sideHelped("game-speed", 1)).toBe("attack");
    expect(sideHelped("game-speed", -1)).toBe("defense");
  });

  it("Volume down helps attack; Volume up helps defense", () => {
    expect(sideHelped("volume", -1)).toBe("attack");
    expect(sideHelped("volume", 1)).toBe("defense");
  });
});

describe("the price of a drag", () => {
  it("is the step price for a step away from the middle, either way", () => {
    expect(dragPrice("brightness", 0, -1, false)).toBe(STEP);
    expect(dragPrice("brightness", 0, 1, false)).toBe(STEP);
    expect(dragPrice("brightness", 1, 2, false)).toBe(STEP);
  });

  it("is double for a step back toward the middle", () => {
    expect(dragPrice("brightness", -1, 0, false)).toBe(STEP * TOWARD);
    expect(dragPrice("brightness", 2, 1, false)).toBe(STEP * TOWARD);
  });

  it("adds up step by step across the middle", () => {
    // From -1 to 1: one step back to the middle, one away from it.
    expect(dragPrice("brightness", -1, 1, false)).toBe(STEP * TOWARD + STEP);
    expect(dragPrice("brightness", -2, 0, false)).toBe(2 * STEP * TOWARD);
  });

  it("doubles again mid-battle", () => {
    expect(dragPrice("brightness", 0, -1, true)).toBe(STEP * MID);
    expect(dragPrice("brightness", -1, 0, true)).toBe(STEP * TOWARD * MID);
  });

  it("prices Volume by the same rules", () => {
    const volume = SLIDERS.volume.stepPrice;
    expect(dragPrice("volume", 0, -1, false)).toBe(volume);
    expect(dragPrice("volume", -1, 0, false)).toBe(volume * TOWARD);
    expect(dragPrice("volume", 0, 2, true)).toBe(2 * volume * MID);
  });

  it("uses each slider's own step price", () => {
    expect(dragPrice("game-speed", 0, 1, false)).toBe(
      SLIDERS["game-speed"].stepPrice,
    );
  });

  it("is null off the end of the slider or for no move", () => {
    expect(dragPrice("brightness", 2, 3, false)).toBeNull();
    expect(dragPrice("brightness", -2, -3, false)).toBeNull();
    expect(dragPrice("brightness", 1, 1, false)).toBeNull();
    expect(dragPrice("brightness", 0, 0.5, false)).toBeNull();
  });
});

describe("slider positions over a battle", () => {
  const inputs = [
    { step: 10, slider: "brightness" as const, position: -1 },
    { step: 20, slider: "game-speed" as const, position: 1 },
    { step: 30, slider: "brightness" as const, position: -2 },
  ];

  it("follow each input from its step on", () => {
    expect(slidersAt(NEUTRAL_SLIDERS, inputs, 9)).toEqual(NEUTRAL_SLIDERS);
    expect(slidersAt(NEUTRAL_SLIDERS, inputs, 10)).toEqual({
      brightness: -1,
      volume: 0,
      "game-speed": 0,
    });
    expect(slidersAt(NEUTRAL_SLIDERS, inputs, 25)).toEqual({
      brightness: -1,
      volume: 0,
      "game-speed": 1,
    });
  });

  it("end where the last input left them", () => {
    expect(slidersAfter(NEUTRAL_SLIDERS, inputs)).toEqual({
      brightness: -2,
      volume: 0,
      "game-speed": 1,
    });
  });
});
