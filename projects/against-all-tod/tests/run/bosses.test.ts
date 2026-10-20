import { describe, expect, it } from "vitest";
import { BOSS_RULES } from "../../src/catalog/bosses";
import { CRATE_RULES } from "../../src/catalog/pools";
import { crateFor } from "../../src/run/crate";
import {
  applyRunAction,
  battleSetupOf,
  bossOf,
  newRun,
  piecePriceNow,
  roundOf,
  runStatusOf,
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

function finish(state: RunState, won: boolean): RunState {
  const side = sideOf(state);
  return play(
    state,
    { type: "start-battle" },
    {
      type: "battle-finished",
      winner: won ? side : side === "attack" ? "defense" : "attack",
      earned: { defense: 0, attack: 0 },
      destroyed: [],
    },
    { type: "continue" },
  );
}

/** The Run at the start of `round`, every Round before it won. */
function atRound(round: number, seed = 7): RunState {
  let state = newRun(seed);
  while (roundOf(state) < round) state = finish(state, true);
  return state;
}

const BOSS_ROUND = BOSS_RULES.bossRoundEvery;

describe("Boss Round timing", () => {
  it("makes every fifth Round a Boss Round, with the boss for the side played against", () => {
    const bosses = Array.from({ length: 3 * BOSS_ROUND }, (_, index) =>
      bossOf(atRound(index + 1)),
    );
    expect(bosses[BOSS_ROUND - 1]).toBe("landlord");
    expect(bosses[2 * BOSS_ROUND - 1]).toBe("hr-department");
    expect(bosses[3 * BOSS_ROUND - 1]).toBe("landlord");
    expect(bosses.filter((boss) => boss !== null)).toHaveLength(3);
  });

  it("puts The Landlord against the Defense turn and The HR Department against the Attack turn", () => {
    const landlordRound = atRound(BOSS_ROUND);
    expect(sideOf(landlordRound)).toBe("defense");
    expect(battleSetupOf(landlordRound).boss).toBe("landlord");
    const hrRound = atRound(2 * BOSS_ROUND);
    expect(sideOf(hrRound)).toBe("attack");
    expect(battleSetupOf(hrRound).boss).toBe("hr-department");
    expect(runStatusOf(hrRound).boss).toBe("hr-department");
  });

  it("brings the boss back on a Rewind, and drops it once the Round is won", () => {
    const bossRound = atRound(BOSS_ROUND);
    const rewound = finish(bossRound, false);
    expect(roundOf(rewound)).toBe(BOSS_ROUND);
    expect(bossOf(rewound)).toBe("landlord");
    const won = finish(bossRound, true);
    expect(bossOf(won)).toBeNull();
    expect(battleSetupOf(won).boss).toBeNull();
    expect(won.pieces).toEqual(bossRound.pieces);
  });
});

describe("the boss crate", () => {
  it("follows a won Boss Round: 5 items, 2 picks", () => {
    const before = atRound(BOSS_ROUND);
    expect(before.crate?.items).toHaveLength(CRATE_RULES.size);
    const after = finish(before, true);
    expect(after.crate?.items).toHaveLength(BOSS_RULES.bossCrate.size);
    expect(after.crate?.picks).toBe(BOSS_RULES.bossCrate.picks);
    expect(finish(after, true).crate?.items).toHaveLength(CRATE_RULES.size);
  });

  it("gives the same boss crate again after a Rewind", () => {
    const after = finish(atRound(BOSS_ROUND), true);
    expect(finish(after, false).crate).toEqual(after.crate);
  });

  it("stays open after the first pick and closes after the second, both free", () => {
    const after = finish(atRound(BOSS_ROUND), true);
    expect(sideOf(after)).toBe("attack");
    const first = play(after, { type: "take-from-crate", index: 0 });
    expect(first.crate?.items).toEqual(after.crate?.items.slice(1));
    expect(first.crate?.picks).toBe(1);
    const second = play(first, { type: "take-from-crate", index: 0 });
    expect(second.crate).toBeNull();
    expect(second.wallets).toEqual(after.wallets);
    expect(refusalOf(second, { type: "take-from-crate", index: 0 })).toBe(
      "no-crate",
    );
  });

  it("lets two Pieces wait to be placed for free", () => {
    // Round 11 is a Defense turn whose crate follows the Boss Round 10.
    const after = finish(atRound(2 * BOSS_ROUND), true);
    expect(sideOf(after)).toBe("defense");
    const items = after.crate?.items ?? [];
    const pieces = items.flatMap((item, index) =>
      item.kind === "piece" ? [{ id: item.id, index }] : [],
    );
    const [one, two] = pieces;
    if (one === undefined || two === undefined) {
      throw new Error("fewer than 2 Pieces offered");
    }
    const taken = play(
      after,
      { type: "take-from-crate", index: two.index },
      { type: "take-from-crate", index: one.index },
    );
    expect(taken.freeItems).toEqual([
      { kind: "piece", id: two.id },
      { kind: "piece", id: one.id },
    ]);
    expect(piecePriceNow(taken, one.id)).toBe(0);
    expect(piecePriceNow(taken, two.id)).toBe(0);
  });

  it("keeps its picks left when rerolled after a pick", () => {
    const after = finish(atRound(BOSS_ROUND), true);
    const picked = play(after, { type: "take-from-crate", index: 0 });
    const rerolled = play(picked, { type: "reroll-crate" });
    expect(rerolled.crate?.picks).toBe(1);
    expect(rerolled.crate?.items).toHaveLength(BOSS_RULES.bossCrate.size);
  });

  it("holds a free Undo about as often as the catalog's chance, and only boss crates do", () => {
    const seeds = Array.from({ length: 400 }, (_, seed) => seed * 7919);
    const withUndo = seeds.filter((seed) =>
      crateFor(seed, "defense", [], 0, 0, "boss").items.some(
        (item) => item.kind === "free-undo",
      ),
    );
    const share = withUndo.length / seeds.length;
    expect(share).toBeGreaterThan(BOSS_RULES.bossCrate.freeUndoChance - 0.1);
    expect(share).toBeLessThan(BOSS_RULES.bossCrate.freeUndoChance + 0.1);
    for (const seed of seeds) {
      const crate = crateFor(seed, "attack", [], 0, 0, "boss");
      expect(crate.items).toHaveLength(BOSS_RULES.bossCrate.size);
      expect(
        crateFor(seed, "attack", [], 0, 0).items.some(
          (item) => item.kind === "free-undo",
        ),
      ).toBe(false);
    }
  });

  it("gives a taken free Undo to the player to hold", () => {
    const state = atRound(BOSS_ROUND + 1);
    const offered: RunState = {
      ...state,
      crate: {
        kind: "boss",
        items: [{ kind: "free-undo" }],
        picks: 2,
        rerolls: 0,
      },
    };
    const taken = play(offered, { type: "take-from-crate", index: 0 });
    expect(taken.freeUndos).toBe(state.freeUndos + 1);
  });

  /** The Round after a won Boss Round whose boss crate holds a free Undo, and where it is. */
  function bossCrateWithUndo(): { state: RunState; index: number } {
    for (let seed = 1; seed < 200; seed++) {
      const state = finish(atRound(BOSS_ROUND, seed), true);
      const index =
        state.crate?.items.findIndex((item) => item.kind === "free-undo") ?? -1;
      if (index >= 0) return { state, index };
    }
    throw new Error("no seed gives a free Undo");
  }

  it("takes back a free Undo taken in a Round that is lost, so a Rewind can't double it", () => {
    const { state, index } = bossCrateWithUndo();
    const taken = play(state, { type: "take-from-crate", index });
    expect(taken.freeUndos).toBe(state.freeUndos + 1);
    const rewound = finish(taken, false);
    expect(rewound.freeUndos).toBe(state.freeUndos);
    const again = play(rewound, { type: "take-from-crate", index });
    expect(again.freeUndos).toBe(state.freeUndos + 1);
    expect(finish(again, true).freeUndos).toBe(state.freeUndos + 1);
  });

  it("never offers a second free Undo after rerolling once one is taken", () => {
    const { state, index } = bossCrateWithUndo();
    let crate = play(state, { type: "take-from-crate", index });
    for (let reroll = 0; reroll < 10; reroll++) {
      crate = play(
        { ...crate, wallets: state.wallets },
        { type: "reroll-crate" },
      );
      expect(crate.crate?.items.some((item) => item.kind === "free-undo")).toBe(
        false,
      );
    }
  });
});
