import { describe, expect, it } from "vitest";
import { CRATE_RULES } from "../../src/catalog/pools";
import {
  crateItemDescription,
  crateItemName,
  rerollLabel,
} from "../../src/ui/crate";

describe("crate labels", () => {
  it("names each kind of item", () => {
    expect(crateItemName({ kind: "piece", id: "sniper-nest" })).toBe(
      "Sniper Nest",
    );
    expect(crateItemName({ kind: "squad", id: "intern" })).toBe("Intern Squad");
    expect(crateItemName({ kind: "mutation", id: "gold-teeth" })).toBe(
      "Gold Teeth Mutation",
    );
  });

  it("describes an item from the catalog", () => {
    expect(crateItemDescription({ kind: "mutation", id: "split" })).toMatch(
      /splits/,
    );
  });

  it("shows the side's reroll price", () => {
    expect(rerollLabel("defense")).toBe(
      `Reroll · ${String(CRATE_RULES.rerollPrice.defense)}g`,
    );
  });
});
