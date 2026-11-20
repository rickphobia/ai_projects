import { describe, expect, it } from "vitest";
import { fullScreenLabel } from "../../src/ui/full-screen";

describe("fullScreenLabel", () => {
  it("offers full screen, then the way back out, never as a bare icon", () => {
    expect(fullScreenLabel(false)).toBe("⛶ Full screen");
    expect(fullScreenLabel(true)).toBe("⛶ Exit full screen");
  });
});
