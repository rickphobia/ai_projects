import { describe, expect, it } from "vitest";
import { CRATE_RULES } from "../../src/catalog/pools";
import {
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

  it("shows the side's reroll price", () => {
    expect(rerollLabel("defense")).toBe(
      `Reroll · ${String(CRATE_RULES.rerollPrice.defense)}g`,
    );
  });
});
