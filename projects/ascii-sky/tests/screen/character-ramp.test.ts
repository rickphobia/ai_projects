import { describe, expect, it } from "vitest";
import { CHARACTER_RAMP, rampCharacter } from "../../src/screen/character-ramp";

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
