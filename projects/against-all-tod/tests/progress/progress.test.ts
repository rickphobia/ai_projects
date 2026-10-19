import { describe, expect, it } from "vitest";
import {
  dudeKindsOnSale,
  isCrateItemUnlocked,
  newUnlocks,
  nextUnlock,
  unlocksAt,
  UNLOCKS,
} from "../../src/progress/progress";

describe("Unlocks", () => {
  it("come in the catalog's milestone order", () => {
    expect(UNLOCKS.map(({ id, score }) => [id, score])).toEqual([
      ["sapper", 5],
      ["bouncer", 10],
      ["mole", 15],
      ["decoy-goal", 20],
      ["streaker", 25],
    ]);
  });

  it("are earned by reaching a milestone", () => {
    expect(unlocksAt(0)).toEqual([]);
    expect(unlocksAt(4)).toEqual([]);
    expect(unlocksAt(5).map(({ id }) => id)).toEqual(["sapper"]);
    expect(unlocksAt(14).map(({ id }) => id)).toEqual(["sapper", "bouncer"]);
    expect(unlocksAt(99)).toHaveLength(5);
  });

  it("names only the ones a new best Score earned", () => {
    expect(newUnlocks(4, 12).map(({ id }) => id)).toEqual([
      "sapper",
      "bouncer",
    ]);
    expect(newUnlocks(12, 12)).toEqual([]);
    expect(newUnlocks(12, 9)).toEqual([]);
  });

  it("show the next one with its Score, and none once all are earned", () => {
    expect(nextUnlock(0)).toMatchObject({ name: "Sapper", score: 5 });
    expect(nextUnlock(5)).toMatchObject({ name: "Bouncer", score: 10 });
    expect(nextUnlock(25)).toBeNull();
  });
});

describe("pools", () => {
  it("leave out locked Pieces and Dude kinds", () => {
    expect(isCrateItemUnlocked({ kind: "piece", id: "bouncer" }, 9)).toBe(
      false,
    );
    expect(isCrateItemUnlocked({ kind: "piece", id: "bouncer" }, 10)).toBe(
      true,
    );
    expect(isCrateItemUnlocked({ kind: "gift", id: "sapper" }, 4)).toBe(false);
    expect(isCrateItemUnlocked({ kind: "piece", id: "crate-wall" }, 0)).toBe(
      true,
    );
  });

  it("put Unlocked Dude kinds on sale", () => {
    expect(dudeKindsOnSale(0)).not.toContain("sapper");
    expect(dudeKindsOnSale(5)).toContain("sapper");
    expect(dudeKindsOnSale(5)).not.toContain("mole");
    expect(dudeKindsOnSale(99)).toEqual(
      expect.arrayContaining(["sapper", "mole", "streaker"]),
    );
  });
});
