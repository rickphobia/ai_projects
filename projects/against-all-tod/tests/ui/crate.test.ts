import { describe, expect, it } from "vitest";
import { DUDE_KINDS } from "../../src/catalog/dudes";
import { MUTATIONS } from "../../src/catalog/mutations";
import { PIECES } from "../../src/catalog/pieces";
import { CRATE_RULES } from "../../src/catalog/pools";
import { MUTATION_MARKS } from "../../src/ui/crate-marks";
import {
  crateCard,
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

  it("builds a card's text and picture from the catalogue entry", () => {
    expect(crateCard({ kind: "gift", id: "intern" })).toEqual({
      name: "20 free Interns",
      description: DUDE_KINDS.intern.description,
      picture: { kind: "portrait", id: "intern", badge: "×20" },
    });
    expect(crateCard({ kind: "piece", id: "siren" })).toEqual({
      name: "Siren",
      description: PIECES.siren.description,
      picture: { kind: "portrait", id: "siren", badge: null },
    });
    expect(crateCard({ kind: "mutation", id: "giant" })).toEqual({
      name: "Giant Mutation",
      description: MUTATIONS.giant.description,
      picture: { kind: "mark", svg: MUTATION_MARKS.giant },
    });
  });

  it("shows the side's reroll price", () => {
    expect(rerollLabel("defense")).toBe(
      `Reroll, ${String(CRATE_RULES.rerollPrice.defense)} Defense gold`,
    );
  });
});
