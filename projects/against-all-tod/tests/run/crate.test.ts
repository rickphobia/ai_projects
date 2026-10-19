import { describe, expect, it } from "vitest";
import {
  CRATE_POOLS,
  CRATE_RULES,
  type CrateItem,
} from "../../src/catalog/pools";
import { PIECES } from "../../src/catalog/pieces";
import { crateFor } from "../../src/run/crate";
import {
  applyRunAction,
  newRun,
  piecePriceNow,
  sideOf,
  type RunAction,
  type RunState,
} from "../../src/run/run";

function play(state: RunState, ...actions: RunAction[]): RunState {
  return actions.reduce((current, action) => {
    const result = applyRunAction(current, action);
    if (!result.ok) {
      throw new Error(`${action.type} refused: ${result.refusal}`);
    }
    return result.state;
  }, state);
}

function refusalOf(state: RunState, action: RunAction): string | null {
  const result = applyRunAction(state, action);
  return result.ok ? null : result.refusal;
}

const NOTHING_EARNED = { defense: 0, attack: 0 };

function finish(state: RunState, winner: "attack" | "defense"): RunState {
  return play(
    state,
    { type: "start-battle" },
    {
      type: "battle-finished",
      winner,
      earned: NOTHING_EARNED,
      destroyed: [],
    },
  );
}

/** Round 2, an Attack turn, with its crate. */
function attackTurn(seed = 7): RunState {
  return play(finish(newRun(seed), "defense"), { type: "continue" });
}

function inPool(item: CrateItem, pool: readonly CrateItem[]): boolean {
  return pool.some((each) => JSON.stringify(each) === JSON.stringify(item));
}

describe("Draft Crate", () => {
  it("offers crate-size items from the side's pool", () => {
    const defense = newRun(1);
    const attack = attackTurn();
    expect(sideOf(attack)).toBe("attack");
    for (const [state, side] of [
      [defense, "defense"],
      [attack, "attack"],
    ] as const) {
      expect(state.crate?.items).toHaveLength(CRATE_RULES.size);
      for (const item of state.crate?.items ?? []) {
        expect(inPool(item, CRATE_POOLS[side])).toBe(true);
      }
    }
  });

  it("holds only Pieces on defense, and Squads and Mutations on attack", () => {
    for (let seed = 0; seed < 20; seed += 1) {
      for (const item of newRun(seed).crate?.items ?? []) {
        expect(item.kind).toBe("piece");
      }
      for (const item of attackTurn(seed).crate?.items ?? []) {
        expect(item.kind).not.toBe("piece");
      }
    }
  });

  it("rolls the same crate from the same seed", () => {
    expect(newRun(42).crate).toEqual(newRun(42).crate);
    expect(crateFor(9, "attack", [], 0)).toEqual(crateFor(9, "attack", [], 0));
  });

  it("offers different items when the pool is big enough", () => {
    const ids = crateFor(3, "attack", [], 0).items.map((item) =>
      JSON.stringify(item),
    );
    expect(new Set(ids).size).toBe(CRATE_RULES.size);
  });

  it("leaves out Mutations the Army already has", () => {
    const owned = CRATE_POOLS.attack.flatMap((item) =>
      item.kind === "mutation" ? [item.id] : [],
    );
    const items = crateFor(5, "attack", owned, 0).items;
    expect(items.every((item) => item.kind === "gift")).toBe(true);
  });

  it("gives the taken Piece for free and discards the rest", () => {
    const start = newRun(1);
    const index = 0;
    const taken = play(start, { type: "take-from-crate", index });
    const item = start.crate?.items[index];
    if (item?.kind !== "piece")
      throw new Error("defense crate without a Piece");
    expect(taken.crate).toBeNull();
    expect(taken.wallets).toEqual(start.wallets);
    expect(piecePriceNow(taken, item.id)).toBe(0);

    const placed = play(taken, {
      type: "place-piece",
      tile: { column: 5, row: 1 },
      pieceId: item.id,
    });
    expect(placed.wallets).toEqual(start.wallets);
    expect(placed.freeItems).toEqual([]);
    expect(piecePriceNow(placed, item.id)).toBe(PIECES[item.id].price);
    expect(refusalOf(placed, { type: "take-from-crate", index: 1 })).toBe(
      "no-crate",
    );
  });

  it("stores a taken Mutation on the Army", () => {
    const start = attackTurn();
    const index = start.crate?.items.findIndex((i) => i.kind === "mutation");
    if (index === undefined || index < 0)
      throw new Error("no Mutation offered");
    const item = start.crate?.items[index];
    if (item?.kind !== "mutation") throw new Error("no Mutation offered");
    const taken = play(start, { type: "take-from-crate", index });
    expect(taken.mutations).toEqual([item.id]);
    expect(taken.wallets).toEqual(start.wallets);
  });

  it("refuses an item the crate doesn't have", () => {
    expect(refusalOf(newRun(1), { type: "take-from-crate", index: 3 })).toBe(
      "no-crate",
    );
  });

  it("rerolls for the side's own gold at the catalog price", () => {
    const start = newRun(1);
    const rerolled = play(start, { type: "reroll-crate" });
    expect(rerolled.wallets).toEqual({
      ...start.wallets,
      defense: start.wallets.defense - CRATE_RULES.rerollPrice.defense,
    });
    expect(rerolled.crate?.rerolls).toBe(1);

    const attack = attackTurn();
    const attackRerolled = play(attack, { type: "reroll-crate" });
    expect(attackRerolled.wallets).toEqual({
      ...attack.wallets,
      attack: attack.wallets.attack - CRATE_RULES.rerollPrice.attack,
    });
  });

  it("refuses a reroll the wallet can't pay for, or after taking", () => {
    const broke: RunState = {
      ...newRun(1),
      wallets: { defense: CRATE_RULES.rerollPrice.defense - 1, attack: 999 },
    };
    expect(refusalOf(broke, { type: "reroll-crate" })).toBe("not-enough-gold");
    const taken = play(newRun(1), { type: "take-from-crate", index: 0 });
    expect(refusalOf(taken, { type: "reroll-crate" })).toBe("no-crate");
  });

  it("gives back the same crate and pick after a Rewind", () => {
    const start = attackTurn();
    const index = start.crate?.items.findIndex((i) => i.kind === "mutation");
    if (index === undefined || index < 0)
      throw new Error("no Mutation offered");
    const played = play(
      start,
      { type: "reroll-crate" },
      { type: "take-from-crate", index: 0 },
    );
    const rewound = play(finish(played, "defense"), { type: "continue" });
    expect(rewound.crate).toEqual(start.crate);
    expect(rewound.mutations).toEqual(start.mutations);
    expect(rewound.freeItems).toEqual([]);
    const again = play(rewound, { type: "take-from-crate", index });
    const item = start.crate?.items[index];
    if (item?.kind !== "mutation") throw new Error("no Mutation offered");
    expect(again.mutations).toEqual([item.id]);
  });

  it("opens a new crate for the next Round, keeping Mutations", () => {
    const start = attackTurn();
    const index = start.crate?.items.findIndex((i) => i.kind === "mutation");
    if (index === undefined || index < 0)
      throw new Error("no Mutation offered");
    const taken = play(start, { type: "take-from-crate", index });
    const next = play(finish(taken, "attack"), { type: "continue" });
    expect(sideOf(next)).toBe("defense");
    expect(next.crate?.items.every((i) => i.kind === "piece")).toBe(true);
    expect(next.mutations).toEqual(taken.mutations);
  });
});
