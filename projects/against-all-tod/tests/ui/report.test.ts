import { describe, expect, it } from "vitest";
import type { BattleEvent } from "../../src/battle/events";
import { DUDE_KINDS } from "../../src/catalog/dudes";
import { GOLD_RULES } from "../../src/catalog/gold-rules";
import { BOARD_COLUMNS } from "../../src/maze/board";
import { goldLines, roundReport } from "../../src/ui/report";

const nest = { column: 5, row: 3 };
const kill = (
  step: number,
  pieceId: "sniper-nest" | "crate-wall",
  x: number,
  y: number,
): BattleEvent => ({
  type: "kill",
  step,
  pieceId,
  pieceTile: nest,
  dudeId: step,
  dudeKind: "intern",
  at: { x, y },
});

const events: BattleEvent[] = [
  kill(1, "sniper-nest", 2.5, 4.5),
  kill(2, "sniper-nest", 2.9, 4.1),
  kill(3, "crate-wall", 7.2, 0.5),
  { type: "reach-goal", step: 4, dudeId: 9, dudeKind: "intern", damage: 3 },
  { type: "reach-goal", step: 5, dudeId: 10, dudeKind: "intern", damage: 4 },
  {
    type: "shot",
    step: 1,
    pieceId: "sniper-nest",
    pieceTile: nest,
    dudeId: 1,
    at: { x: 2.5, y: 4.5 },
  },
];

describe("roundReport", () => {
  const report = roundReport(events, {
    winner: "defense",
    goalHealth: 13,
    survivors: [],
    mutations: [],
  });

  it("adds up the Goal damage", () => {
    expect(report.goalDamage).toBe(7);
  });

  it("counts kills per Piece, most first", () => {
    expect(report.killsByPiece).toEqual([
      { pieceId: "sniper-nest", kills: 2 },
      { pieceId: "crate-wall", kills: 1 },
    ]);
  });

  it("maps deaths over the Board's real width, Spawn zone included", () => {
    expect(report.deaths).toHaveLength(14);
    expect(report.deaths.every((row) => row.length === 22)).toBe(true);
  });

  it("puts each death on the tile it happened on", () => {
    expect(report.deaths[4]?.[2]).toBe(2);
    expect(report.deaths[0]?.[7]).toBe(1);
    expect(report.deaths.flat().reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("keeps a death on the Board's far edge on the Board", () => {
    const edge = roundReport([kill(1, "sniper-nest", BOARD_COLUMNS, 2)], {
      winner: "defense",
      goalHealth: 20,
      survivors: [],
      mutations: [],
    });
    expect(edge.deaths[2]?.[BOARD_COLUMNS - 1]).toBe(1);
  });

  it("breaks the gold down per wallet", () => {
    const value = DUDE_KINDS.intern.goldValue;
    expect(report.gold).toEqual({
      defense: {
        kills: 3 * GOLD_RULES.perKill * value,
        goalHealthLeft: Math.floor(13 * GOLD_RULES.perGoalHealthLeft),
        taxed: 0,
      },
      attack: {
        reachedGoal: 2 * GOLD_RULES.perReachGoal * value,
        survivors: 0,
        piecesDestroyed: 0,
        taxPaid: 0,
      },
    });
    expect(goldLines(report.gold).defense[0]).toEqual([
      "Kills",
      report.gold.defense.kills,
    ]);
  });
});
