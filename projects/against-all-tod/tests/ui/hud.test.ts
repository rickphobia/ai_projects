import { describe, expect, it } from "vitest";
import type { PlacementRefusal } from "../../src/maze/maze";
import { refusalMessage } from "../../src/ui/hud";

describe("refusalMessage", () => {
  it.each<PlacementRefusal>([
    "off-board",
    "spawn-line",
    "goal",
    "tile-taken",
    "seals-goal",
  ])("explains a %s refusal", (refusal) => {
    expect(refusalMessage(refusal).length).toBeGreaterThan(0);
  });

  it("says why sealing the Goal is refused", () => {
    expect(refusalMessage("seals-goal")).toMatch(/seal the Goal/);
  });
});
