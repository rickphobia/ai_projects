import { describe, expect, it } from "vitest";
import {
  finalLevel,
  soundsOf,
  trickLoudness,
} from "../../../src/adapters/audio/sound-level";
import type { BattleEvent } from "../../../src/battle/events";
import { TRICK_RULES } from "../../../src/catalog/tricks";

describe("the final sound level", () => {
  it("is the actual volume when the Volume slider is in the middle", () => {
    expect(finalLevel(0.5, 0)).toBe(0.5);
    expect(finalLevel(0, 0)).toBe(0);
  });

  it("is actual volume × the Volume trick's loudness", () => {
    const step = TRICK_RULES.loudnessPerVolumeStep;
    expect(finalLevel(0.5, -1)).toBeCloseTo(0.5 * (1 - step));
    expect(finalLevel(0.5, 1)).toBeCloseTo(0.5 * (1 + step));
  });

  it("really quiets the game as Volume goes down", () => {
    expect(finalLevel(1, -2)).toBeLessThan(finalLevel(1, -1));
    expect(finalLevel(1, -1)).toBeLessThan(finalLevel(1, 0));
  });

  it("never goes above 1 or below 0", () => {
    expect(finalLevel(1, 2)).toBe(1);
    expect(finalLevel(2, 0)).toBe(1);
    expect(finalLevel(-1, 0)).toBe(0);
    expect(trickLoudness(-100)).toBe(0);
  });
});

describe("the sounds a frame makes", () => {
  const at = { x: 1, y: 1 };
  const tile = { column: 1, row: 1 };

  it("plays each kind once, however many events fired", () => {
    const events: BattleEvent[] = [
      {
        type: "shot",
        step: 1,
        pieceId: "sniper-nest",
        pieceTile: tile,
        dudeId: 0,
        at,
      },
      {
        type: "shot",
        step: 1,
        pieceId: "sniper-nest",
        pieceTile: tile,
        dudeId: 1,
        at,
      },
      {
        type: "kill",
        step: 1,
        pieceId: "sniper-nest",
        pieceTile: tile,
        dudeId: 0,
        dudeKind: "intern",
        at,
      },
      { type: "reach-goal", step: 1, dudeId: 2, dudeKind: "intern", damage: 1 },
      {
        type: "taxed",
        step: 1,
        pieceTile: tile,
        dudeId: 3,
        dudeKind: "intern",
      },
    ];
    expect([...soundsOf(events)].sort()).toEqual(
      ["gold", "goal-hit", "kill", "shot"].sort(),
    );
  });

  it("is silent when nothing happened", () => {
    expect(soundsOf([]).size).toBe(0);
  });
});
