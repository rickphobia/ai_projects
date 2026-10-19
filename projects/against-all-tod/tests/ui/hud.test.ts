import { describe, expect, it } from "vitest";
import { BOSSES } from "../../src/catalog/bosses";
import { CURSES } from "../../src/catalog/curses";
import type { RunRefusal } from "../../src/run/run";
import {
  battleStatus,
  bossAnnouncement,
  curseAnnouncement,
  curseStatus,
  outcomeMessage,
  refusalMessage,
  roundOverMessage,
  runStatus,
} from "../../src/ui/hud";

describe("refusalMessage", () => {
  it.each<RunRefusal>([
    "off-board",
    "spawn-zone",
    "goal",
    "tile-taken",
    "seals-goal",
    "wrong-phase",
    "wrong-side",
    "not-enough-gold",
    "not-spawn-zone",
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
      runStatus({
        round: 3,
        side: "defense",
        lives: 2,
        score: 2,
        wallets,
        curse: null,
        boss: null,
      }),
    ).toBe(
      "Round 3 · Defense turn · Lives 2 · Score 2 · Defense gold 50 · Attack gold 40",
    );
    expect(
      runStatus({
        round: 4,
        side: "attack",
        lives: 1,
        score: 3,
        wallets,
        curse: null,
        boss: null,
      }),
    ).toBe(
      "Round 4 · Attack turn · Lives 1 · Score 3 · Defense gold 50 · Attack gold 40",
    );
  });
});

describe("the Curse in the HUD", () => {
  it("ends the status line with the Round's Curse and its effect", () => {
    const wallets = { defense: 50, attack: 40 };
    expect(
      runStatus({
        round: 2,
        side: "attack",
        lives: 3,
        score: 1,
        wallets,
        curse: "rust",
        boss: null,
      }),
    ).toBe(
      `Round 2 · Attack turn · Lives 3 · Score 1 · Defense gold 50 · Attack gold 40 · ${curseStatus("rust")}`,
    );
    expect(curseStatus("rust")).toBe("Curse: Rust (towers fire 20% slower)");
  });

  it("announces the Curse with the side it hurts and what it does", () => {
    expect(curseAnnouncement("mud")).toBe(
      `Curse this Round: Mud, hurting the attack. ${CURSES.mud.description}`,
    );
  });
});

describe("the boss in the HUD", () => {
  it("names the Boss Round's boss on the status line and announces what it does", () => {
    expect(
      runStatus({
        round: 5,
        side: "defense",
        lives: 3,
        score: 4,
        wallets: { defense: 50, attack: 40 },
        curse: null,
        boss: "landlord",
      }),
    ).toMatch(/ · Boss: The Landlord$/);
    expect(bossAnnouncement("hr-department")).toBe(
      `Boss Round: The HR Department. ${BOSSES["hr-department"].description}`,
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
