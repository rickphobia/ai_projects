import { describe, expect, it } from "vitest";
import type { BattleEvent } from "../src/battle/events";
import { DUDE_KINDS } from "../src/catalog/dudes";
import { GOLD_RULES } from "../src/catalog/gold-rules";
import { MUTATION_RULES } from "../src/catalog/mutations";
import { bossFell, goldPopsOf, refundSpot } from "../src/effect-cues";
import { BOARD_COLUMNS, BOARD_ROWS, goalTiles } from "../src/maze/board";
import { applyRunAction, newRun, type RunState } from "../src/run/run";

const tile = { column: 6, row: 3 };

function kill(dudeKind: "intern" | "landlord"): BattleEvent {
  return {
    type: "kill",
    step: 1,
    pieceId: "sniper-nest",
    pieceTile: tile,
    dudeId: 1,
    dudeKind,
    at: { x: 7.2, y: 3.6 },
  };
}

const reachGoal: BattleEvent = {
  type: "reach-goal",
  step: 1,
  dudeId: 2,
  dudeKind: "intern",
  damage: 1,
};

describe("gold pops", () => {
  it("pops a kill's gold where the Dude fell", () => {
    expect(goldPopsOf([kill("intern")], [])).toEqual([
      {
        at: { x: 7.2, y: 3.6 },
        amount: GOLD_RULES.perKill * DUDE_KINDS.intern.goldValue,
      },
    ]);
  });

  it("pops a Dude's gold for reaching the Goal at the Goal, with Gold Teeth's bonus", () => {
    const [pop] = goldPopsOf([reachGoal], ["gold-teeth"]);
    const goalColumn = goalTiles()[0]?.column ?? -1;
    expect(pop?.at.x).toBe(goalColumn + 0.5);
    expect(pop?.amount).toBe(
      GOLD_RULES.perReachGoal *
        DUDE_KINDS.intern.goldValue *
        MUTATION_RULES.goldTeethMultiplier,
    );
  });

  it("shows the Tax Booth's takings but not the tax paid", () => {
    const taxed: BattleEvent = {
      type: "taxed",
      step: 1,
      pieceTile: tile,
      dudeId: 3,
      dudeKind: "intern",
    };
    expect(goldPopsOf([taxed], [])).toEqual([
      { at: { x: 6.5, y: 3.5 }, amount: GOLD_RULES.perTaxedDude },
    ]);
  });

  it("pops nothing for a shot", () => {
    const shot: BattleEvent = {
      type: "shot",
      step: 1,
      pieceId: "sniper-nest",
      pieceTile: tile,
      dudeId: 1,
      at: { x: 7, y: 3 },
    };
    expect(goldPopsOf([shot], [])).toEqual([]);
  });
});

describe("boss moments", () => {
  it("shakes when The Landlord dies or The HR Department falls, not for anyone else", () => {
    expect(bossFell([kill("landlord")])).toBe(true);
    expect(
      bossFell([
        {
          type: "piece-destroyed",
          step: 1,
          pieceId: "hr-department",
          pieceTile: tile,
          dudeId: 1,
          dudeKind: "ram-crew",
        },
      ]),
    ).toBe(true);
    expect(bossFell([kill("intern"), reachGoal])).toBe(false);
  });
});

describe("refund spot", () => {
  const start: RunState = {
    ...newRun(1),
    wallets: { defense: 1000, attack: 1000 },
  };

  it("is the Piece Take back took off the Board", () => {
    const placed = applyRunAction(start, {
      type: "place-piece",
      tile,
      pieceId: "crate-wall",
    });
    if (!placed.ok) throw new Error(placed.refusal);
    const back = applyRunAction(placed.state, { type: "take-back" });
    if (!back.ok) throw new Error(back.refusal);
    expect(refundSpot(placed.state, back.state)).toEqual({ x: 6.5, y: 3.5 });
  });

  it("is the middle of the Dudes it took out of the Spawn zone", () => {
    const stays = {
      dudeKind: "intern",
      at: { x: 1, y: 1 },
      stroke: 0,
      round: 1,
    } as const;
    const before: RunState = {
      ...start,
      army: [
        stays,
        { ...stays, at: { x: 2, y: 4 }, stroke: 1 },
        { ...stays, at: { x: 4, y: 6 }, stroke: 1 },
      ],
    };
    const after: RunState = { ...start, army: [stays] };
    expect(refundSpot(before, after)).toEqual({ x: 3, y: 5 });
  });

  it("is the Board's middle when nothing on the Board changed", () => {
    expect(refundSpot(start, start)).toEqual({
      x: BOARD_COLUMNS / 2,
      y: BOARD_ROWS / 2,
    });
  });
});
