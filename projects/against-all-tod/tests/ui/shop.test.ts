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

  it("lists every Dude kind on sale with its Attack gold price per Dude", () => {
    expect(
      attackItems({ ...stock, dudeKinds: ["intern", "termite"] }, []),
    ).toEqual([
      { id: "intern", name: "Intern", price: DUDE_KINDS.intern.dudePrice },
      { id: "termite", name: "Termite", price: DUDE_KINDS.termite.dudePrice },
    ]);
  });

  it("puts the crate gift's count on its kind, adding the kind if the shop doesn't sell it", () => {
    expect(
      attackItems(stock, [{ kind: "gift", id: "intern", left: 12 }]),
    ).toEqual([
      {
        id: "intern",
        name: "Intern",
        price: DUDE_KINDS.intern.dudePrice,
        free: 12,
      },
    ]);
    expect(
      attackItems(stock, [{ kind: "gift", id: "sapper", left: 3 }]).map(
        (item) => item.id,
      ),
    ).toEqual(["intern", "sapper"]);
    expect(attackItems(stock, [{ kind: "piece", id: "siren" }])).toHaveLength(
      1,
    );
  });

  it("labels an item with its price", () => {
    expect(
      itemLabel({ id: "x", name: "Sniper Nest", price: 40 }, "defense"),
    ).toBe("Sniper Nest, 40 Defense gold");
    expect(
      itemLabel({ id: "x", name: "Intern", price: 1, free: 12 }, "attack"),
    ).toBe("Intern, 1 Attack gold, 12 free");
  });
});
