import { describe, expect, it } from "vitest";
import { DUDE_KINDS } from "../../src/catalog/dudes";
import { PIECES } from "../../src/catalog/pieces";
import { attackItems, defenseItems, itemLabel } from "../../src/ui/shop";

const stock = {
  pieces: ["crate-wall", "sniper-nest"],
  dudeKinds: ["intern"],
} as const;

describe("the shop", () => {
  it("lists the Pieces for the Defense side with their Defense gold prices", () => {
    expect(defenseItems(stock)).toEqual([
      {
        id: "crate-wall",
        name: "Crate Wall",
        price: PIECES["crate-wall"].price,
      },
      {
        id: "sniper-nest",
        name: "Sniper Nest",
        price: PIECES["sniper-nest"].price,
      },
    ]);
  });

  it("lists the Squads for the Attack side with their Attack gold prices", () => {
    expect(attackItems(stock)).toEqual([
      {
        id: "intern",
        name: "Intern Squad",
        price: DUDE_KINDS.intern.squadPrice,
      },
    ]);
  });

  it("labels an item with its price", () => {
    expect(itemLabel({ id: "x", name: "Sniper Nest", price: 40 })).toBe(
      "Sniper Nest · 40g",
    );
  });
});
