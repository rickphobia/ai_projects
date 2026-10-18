import { describe, expect, it } from "vitest";
import type { RunRefusal } from "../../src/run/run";
import {
  battleStatus,
  outcomeMessage,
  refusalMessage,
  roundOverMessage,
  runStatus,
} from "../../src/ui/hud";

describe("refusalMessage", () => {
  it.each<RunRefusal>([
    "off-board",
    "spawn-line",
    "goal",
    "tile-taken",
    "seals-goal",
    "wrong-phase",
    "wrong-side",
    "not-enough-gold",
    "not-spawn-line",
  ])("explains a %s refusal", (refusal) => {
    expect(refusalMessage(refusal).length).toBeGreaterThan(0);
  });

  it("says why sealing the Goal is refused", () => {
    expect(refusalMessage("seals-goal")).toMatch(/seal the Goal/);
  });
});

describe("runStatus", () => {
  it("shows the Round, the side, the Lives, the Score and both wallets", () => {
    const wallets = { defense: 50, attack: 40 };
    expect(
      runStatus({ round: 3, side: "defense", lives: 2, score: 2, wallets }),
    ).toBe(
      "Round 3 · Defense turn · Lives 2 · Score 2 · Defense gold 50 · Attack gold 40",
    );
    expect(
      runStatus({ round: 4, side: "attack", lives: 1, score: 3, wallets }),
    ).toBe(
      "Round 4 · Attack turn · Lives 1 · Score 3 · Defense gold 50 · Attack gold 40",
    );
  });
});

describe("roundOverMessage", () => {
  it("says a won Round switches sides", () => {
    expect(roundOverMessage(true, 3)).toMatch(/switch sides/);
  });

  it("counts the Lives left after a loss and says the Board Rewinds", () => {
    expect(roundOverMessage(false, 1)).toMatch(/1 Life left.*Rewinds/);
    expect(roundOverMessage(false, 2)).toMatch(/2 Lives left/);
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
