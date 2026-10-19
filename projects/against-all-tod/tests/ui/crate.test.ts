import { describe, expect, it } from "vitest";
import { CRATE_RULES } from "../../src/catalog/pools";
import {
  crateHeading,
  crateItemDescription,
  crateItemName,
  freeItemLine,
  rerollLabel,
} from "../../src/ui/crate";

describe("crate labels", () => {
  it("names each kind of item", () => {
    expect(crateItemName({ kind: "piece", id: "sniper-nest" })).toBe(
      "Sniper Nest",
    );
    expect(crateItemName({ kind: "gift", id: "intern" })).toBe(
      "20 free Interns",
    );
    expect(crateItemName({ kind: "gift", id: "ram-crew" })).toBe(
      "1 free Ram Crew",
    );
    expect(crateItemName({ kind: "mutation", id: "gold-teeth" })).toBe(
      "Gold Teeth Mutation",
    );
  });

  it("describes an item from the catalog", () => {
    expect(crateItemDescription({ kind: "mutation", id: "split" })).toMatch(
      /splits/,
    );
  });

  it("reminds what is still free once an item is taken", () => {
    expect(freeItemLine({ kind: "piece", id: "siren" })).toBe(
      "Free from the crate: your next Siren.",
    );
    expect(freeItemLine({ kind: "gift", id: "termite", left: 7 })).toBe(
      "Free from the crate: 7 free Termites left to paint.",
    );
  });

  it("names a boss crate and its picks left", () => {
    const items = Array.from({ length: CRATE_RULES.size + 2 }, () => ({
      kind: "free-undo" as const,
    }));
    expect(crateItemName({ kind: "free-undo" })).toBe("Free Undo");
    expect(crateHeading({ kind: "boss", items, picks: 2, rerolls: 0 })).toBe(
      "Boss crate: take 2 for free",
    );
    expect(
      crateHeading({
        kind: "draft",
        items: items.slice(0, CRATE_RULES.size),
        picks: 1,
        rerolls: 0,
      }),
    ).toBe("Draft Crate: take one for free");
  });

  it("shows the side's reroll price", () => {
    expect(rerollLabel("defense")).toBe(
      `Reroll · ${String(CRATE_RULES.rerollPrice.defense)}g`,
    );
  });
});
