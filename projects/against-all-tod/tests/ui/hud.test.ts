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
  statusChips,
  takeBackButton,
} from "../../src/ui/hud";

describe("takeBackButton", () => {
  it("is greyed out with nothing to take back", () => {
    expect(takeBackButton(null)).toEqual({
      disabled: true,
      label: "Nothing to take back",
    });
  });

  it("names the action it would reverse", () => {
    expect(
      takeBackButton({ kind: "place-piece", pieceId: "crate-wall" }),
    ).toEqual({ disabled: false, label: "Take back: Crate Wall" });
    const label = (action: Parameters<typeof takeBackButton>[0]) =>
      takeBackButton(action).label;
    expect(
      label({ kind: "stroke", stroke: 4, dudeKind: "intern", dudes: 12 }),
    ).toBe("Take back: Stroke of 12 Interns");
    expect(label({ kind: "eraser-drag", drag: 0, dudes: 1 })).toBe(
      "Take back: Eraser drag over 1 Dude",
    );
    expect(
      label({ kind: "crate-pick", item: { kind: "piece", id: "siren" } }),
    ).toBe("Take back: Crate pick: Siren");
    expect(label({ kind: "slider", slider: "brightness" })).toBe(
      "Take back: Brightness trick",
    );
  });

  it("explains a refused Take back", () => {
    expect(refusalMessage("nothing-to-take-back")).toMatch(
      /Nothing to take back/,
    );
  });
});

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

const STATUS = {
  round: 3,
  side: "defense",
  lives: 2,
  score: 4,
  wallets: { defense: 50, attack: 40 },
  curse: null,
  boss: null,
  firstRun: false,
} as const;

describe("statusChips", () => {
  it("shows Lives, both wallets, the Score and the Round as icon chips, in that order", () => {
    expect(statusChips(STATUS)).toEqual([
      { kind: "lives", icon: "❤", text: "2", label: "Lives 2" },
      { kind: "defense-gold", icon: "🛡", text: "50", label: "Defense gold 50" },
      { kind: "attack-gold", icon: "⚔", text: "40", label: "Attack gold 40" },
      { kind: "score", icon: "★", text: "4", label: "Score 4" },
      { kind: "round", icon: "", text: "Round 3", label: "Round 3" },
    ]);
  });
});

describe("the Curse in the HUD", () => {
  it("adds a chip with the Round's Curse and its effect", () => {
    expect(statusChips({ ...STATUS, curse: "rust" }).at(-1)).toEqual({
      kind: "curse",
      icon: "☠",
      text: "Rust",
      label: curseStatus("rust"),
    });
    expect(curseStatus("rust")).toBe("Curse: Rust (towers fire 20% slower)");
  });

  it("announces the Curse with the side it hurts and what it does", () => {
    expect(curseAnnouncement("mud")).toBe(
      `Curse this Round: Mud, hurting the attack. ${CURSES.mud.description}`,
    );
  });
});

describe("the boss in the HUD", () => {
  it("adds a chip naming the Boss Round's boss and announces what it does", () => {
    expect(statusChips({ ...STATUS, boss: "landlord" }).at(-1)).toEqual({
      kind: "boss",
      icon: "👑",
      text: "The Landlord",
      label: "Boss: The Landlord",
    });
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
