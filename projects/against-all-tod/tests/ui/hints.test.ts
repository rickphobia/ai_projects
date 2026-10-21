import { describe, expect, it } from "vitest";
import { roundHint } from "../../src/ui/hints";

describe("roundHint", () => {
  it("covers mazing, switching sides and the Settings menu in Rounds 1 to 3", () => {
    expect(roundHint(1, true)).toMatch(/walls/);
    expect(roundHint(2, true)).toMatch(/switch sides/);
    expect(roundHint(3, true)).toMatch(/Settings menu/);
  });

  it("mentions Take back in Rounds 1 and 2", () => {
    expect(roundHint(1, true)).toMatch(/Take back/);
    expect(roundHint(2, true)).toMatch(/Take back/);
  });

  it("stops after Round 3", () => {
    expect(roundHint(4, true)).toBeNull();
  });

  it("shows nothing after the first Run", () => {
    expect(roundHint(1, false)).toBeNull();
    expect(roundHint(2, false)).toBeNull();
  });
});
