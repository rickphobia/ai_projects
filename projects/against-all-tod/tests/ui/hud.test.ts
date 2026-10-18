import { describe, expect, it } from "vitest";
import type { PlacementRefusal } from "../../src/maze/maze";
import { battleStatus, outcomeMessage, refusalMessage } from "../../src/ui/hud";

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

describe("outcomeMessage", () => {
  it("names the attack as winner when the Goal broke", () => {
    expect(
      outcomeMessage({ winner: "attack", reason: "goal-destroyed", step: 9 }),
    ).toMatch(/^Attack wins/);
  });

  it.each(["army-gone", "time-up"] as const)(
    "names the defense as winner when the battle ends by %s",
    (reason) => {
      expect(outcomeMessage({ winner: "defense", reason, step: 9 })).toMatch(
        /^Defense wins/,
      );
    },
  );
});

describe("battleStatus", () => {
  it("shows the Goal's health and the game time", () => {
    expect(battleStatus(85, 100, 83.4)).toBe("Goal 85/100 · 1:23");
  });
});
