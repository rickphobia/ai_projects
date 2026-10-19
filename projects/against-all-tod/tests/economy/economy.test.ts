import { describe, expect, it } from "vitest";
import type {
  KillEvent,
  PieceDestroyedEvent,
  ReachGoalEvent,
  TaxedEvent,
} from "../../src/battle/events";
import { DUDE_KINDS } from "../../src/catalog/dudes";
import { GOLD_RULES, type GoldRules } from "../../src/catalog/gold-rules";
import {
  addGold,
  goldEarned,
  spend,
  type BattleEnd,
} from "../../src/economy/economy";

const at = { x: 1, y: 1 };
const tile = { column: 9, row: 2 };

function kill(step: number): KillEvent {
  return {
    type: "kill",
    step,
    pieceId: "sniper-nest",
    pieceTile: tile,
    dudeId: step,
    dudeKind: "intern",
    at,
  };
}

function reachGoal(step: number): ReachGoalEvent {
  return {
    type: "reach-goal",
    step,
    dudeId: step,
    dudeKind: "intern",
    damage: 5,
  };
}

const pieceDestroyed: PieceDestroyedEvent = {
  type: "piece-destroyed",
  step: 4,
  pieceId: "crate-wall",
  pieceTile: tile,
  dudeId: 1,
  dudeKind: "termite",
};

const DEFENSE_WIN: BattleEnd = {
  winner: "defense",
  goalHealth: 0,
  survivors: [],
};
const ATTACK_WIN: BattleEnd = {
  winner: "attack",
  goalHealth: 0,
  survivors: [],
};

/** Round numbers so each rule's share is easy to see. */
const RULES: GoldRules = {
  ...GOLD_RULES,
  perKill: 3,
  perGoalHealthLeft: 0.5,
  perReachGoal: 5,
  perSurvivor: 7,
  perPieceDestroyed: 11,
};
const intern = DUDE_KINDS.intern.goldValue;

describe("goldEarned", () => {
  it("pays Defense gold per kill, by the Dude's worth", () => {
    expect(goldEarned([kill(1), kill(2)], DEFENSE_WIN, RULES)).toEqual({
      defense: 2 * 3 * intern,
      attack: 0,
    });
  });

  it("pays a Defense bonus for the Goal health left, rounded down, only when Defense wins", () => {
    const end = { ...DEFENSE_WIN, goalHealth: 85 };
    expect(goldEarned([], end, RULES)).toEqual({ defense: 42, attack: 0 });
    expect(goldEarned([], { ...end, winner: "attack" }, RULES).defense).toBe(0);
  });

  it("pays Attack gold per Dude reaching the Goal, by its worth", () => {
    expect(goldEarned([reachGoal(1)], DEFENSE_WIN, RULES)).toEqual({
      defense: 0,
      attack: 5 * intern,
    });
  });

  it("pays Attack gold per survivor only when the Goal breaks", () => {
    const survivors = ["intern", "intern", "intern"] as const;
    expect(goldEarned([], { ...ATTACK_WIN, survivors }, RULES)).toEqual({
      defense: 0,
      attack: 3 * 7 * intern,
    });
    expect(goldEarned([], { ...DEFENSE_WIN, survivors }, RULES).attack).toBe(0);
  });

  it("pays Attack gold per Piece destroyed", () => {
    expect(goldEarned([pieceDestroyed], DEFENSE_WIN, RULES).attack).toBe(11);
  });

  it("adds up a whole battle, each rule into its own wallet", () => {
    const events = [kill(1), reachGoal(2), kill(3), pieceDestroyed];
    expect(
      goldEarned(events, { ...ATTACK_WIN, survivors: ["intern"] }, RULES),
    ).toEqual({
      defense: 2 * 3 * intern,
      attack: 5 * intern + 11 + 7 * intern,
    });
  });

  it("ignores shots", () => {
    const shot = {
      type: "shot",
      step: 1,
      pieceId: "sniper-nest",
      pieceTile: tile,
      dudeId: 1,
      at,
    } as const;
    expect(goldEarned([shot], ATTACK_WIN, RULES)).toEqual({
      defense: 0,
      attack: 0,
    });
  });
});

describe("spend", () => {
  const wallets = { defense: 30, attack: 20 };

  it("takes gold from the paying side only", () => {
    expect(spend(wallets, "defense", 30)).toEqual({ defense: 0, attack: 20 });
    expect(spend(wallets, "attack", 5)).toEqual({ defense: 30, attack: 15 });
  });

  it("refuses when that side is short, whatever the other side has", () => {
    expect(spend(wallets, "attack", 21)).toBeNull();
    expect(spend(wallets, "defense", 31)).toBeNull();
  });
});

describe("addGold", () => {
  it("adds each side's gold to its own wallet", () => {
    expect(
      addGold({ defense: 1, attack: 2 }, { defense: 10, attack: 20 }),
    ).toEqual({ defense: 11, attack: 22 });
  });
});

describe("Tax Booths and Grinders", () => {
  const taxed: TaxedEvent = {
    type: "taxed",
    step: 1,
    pieceTile: tile,
    dudeId: 1,
    dudeKind: "intern",
  };

  it("move Attack gold to Defense gold per Dude taxed", () => {
    const rules = { ...RULES, perTaxedDude: 2 };
    expect(goldEarned([taxed, taxed], ATTACK_WIN, rules)).toEqual({
      defense: 4,
      attack: -4,
    });
  });

  it("never take an Attack wallet below zero", () => {
    expect(
      addGold({ defense: 10, attack: 3 }, { defense: 4, attack: -4 }),
    ).toEqual({
      defense: 14,
      attack: 0,
    });
  });

  it("pay double for a Grinder kill", () => {
    const ground: KillEvent = { ...kill(1), pieceId: "grinder" };
    expect(goldEarned([ground], DEFENSE_WIN, RULES).defense).toBe(
      2 * 3 * intern,
    );
  });
});
