import { describe, expect, it } from "vitest";
import { paintRadius } from "../../src/catalog/dudes";
import type { CrateItem } from "../../src/catalog/pools";
import { SPAWN_ZONE_COLUMNS } from "../../src/maze/board";
import {
  applyRunAction,
  newRun,
  type RunAction,
  type RunState,
} from "../../src/run/run";
import { nextEraserDrag, nextTakeBack } from "../../src/run/take-back";

/** Applies each action in turn, failing the test on the first refusal. */
function play(state: RunState, ...actions: RunAction[]): RunState {
  return actions.reduce((current, action) => {
    const result = applyRunAction(current, action);
    if (!result.ok) {
      throw new Error(`${action.type} refused: ${result.refusal}`);
    }
    return result.state;
  }, state);
}

function refusalOf(state: RunState, action: RunAction) {
  const result = applyRunAction(state, action);
  return result.ok ? null : result.refusal;
}

/** What the player sees of the Run, and all a Take back must restore. */
function seen(state: RunState) {
  return {
    pieces: state.pieces,
    army: state.army,
    wallets: state.wallets,
    crate: state.crate,
    freeItems: state.freeItems,
    mutations: state.mutations,
    freeUndos: state.freeUndos,
    sliders: state.sliders,
  };
}

const TAKE_BACK: RunAction = { type: "take-back" };
const START: RunAction = { type: "start-battle" };

function rich(state: RunState): RunState {
  return { ...state, wallets: { defense: 10_000, attack: 10_000 } };
}

function wall(column: number, row: number): RunAction {
  return { type: "place-piece", tile: { column, row }, pieceId: "crate-wall" };
}

function drag(
  slider: "brightness" | "window-size" | "game-speed",
  to: number,
  atStep = 0,
): RunAction {
  return { type: "drag-slider", slider, to, atStep };
}

/** `count` Interns across the Spawn zone from `row` down, all in Stroke `stroke`. */
function stroke(stroke: number, row: number, count: number): RunAction[] {
  const spacing = 2 * paintRadius("intern") + 0.01;
  const across = Math.floor(SPAWN_ZONE_COLUMNS / spacing);
  return Array.from({ length: count }, (_, index) => ({
    type: "paint-dude",
    dudeKind: "intern",
    at: {
      x: 0.1 + (index % across) * spacing,
      y: row + 0.1 + Math.floor(index / across) * spacing,
    },
    stroke,
  }));
}

function finish(state: RunState, winner: "attack" | "defense"): RunState {
  return play(play(state, START), {
    type: "battle-finished",
    winner,
    earned: { defense: 0, attack: 0 },
    destroyed: [],
  });
}

/** Round 2, an Attack turn, with plenty of gold and one Dude left from Round 1, out of the way. */
const attacking: RunState = {
  ...rich(play(finish(newRun(1), "defense"), { type: "continue" })),
  army: [{ dudeKind: "intern", at: { x: 2.5, y: 12.5 }, stroke: 0, round: 1 }],
};

/** `state` offering exactly `items` in a crate with `picks` picks. */
function offering(
  state: RunState,
  items: readonly CrateItem[],
  picks = 1,
): RunState {
  return { ...state, crate: { kind: "boss", items, picks, rerolls: 0 } };
}

describe("taking back", () => {
  it("refuses with nothing to take back, and outside the building phase", () => {
    expect(refusalOf(newRun(1), TAKE_BACK)).toBe("nothing-to-take-back");
    expect(nextTakeBack(newRun(1))).toBeNull();
    const fighting = play(newRun(1), wall(5, 1), START);
    expect(refusalOf(fighting, TAKE_BACK)).toBe("wrong-phase");
  });

  it("takes a placed Piece off the Board with its price back", () => {
    const start = newRun(1);
    const placed = play(start, wall(5, 1));
    expect(nextTakeBack(placed)).toEqual({
      kind: "place-piece",
      pieceId: "crate-wall",
    });
    expect(seen(play(placed, TAKE_BACK))).toEqual(seen(start));
  });

  it("gives a free Piece back as the free item, and the crate pick back after it", () => {
    const start = offering(newRun(1), [{ kind: "piece", id: "sniper-nest" }]);
    const picked = play(start, { type: "take-from-crate", index: 0 });
    const placed = play(picked, {
      type: "place-piece",
      tile: { column: 5, row: 1 },
      pieceId: "sniper-nest",
    });
    const once = play(placed, TAKE_BACK);
    expect(seen(once)).toEqual(seen(picked));
    expect(seen(play(once, TAKE_BACK))).toEqual(seen(start));
  });

  it("takes a whole Stroke back in one press", () => {
    const painted = play(attacking, ...stroke(50, 4, 6));
    expect(nextTakeBack(painted)).toEqual({
      kind: "stroke",
      stroke: 50,
      dudeKind: "intern",
      dudes: 6,
    });
    const back = play(painted, TAKE_BACK);
    expect(seen(back)).toEqual(seen(attacking));
    expect(refusalOf(back, TAKE_BACK)).toBe("nothing-to-take-back");
  });

  it("returns Gift Dudes to the Gift and refunds only the Dudes paid for", () => {
    const gifted = play(offering(attacking, [{ kind: "gift", id: "intern" }]), {
      type: "take-from-crate",
      index: 0,
    });
    // More than the gift holds, so the Stroke's last Dudes are paid for.
    const painted = play(gifted, ...stroke(50, 4, 22));
    expect(painted.freeItems).toEqual([]);
    expect(painted.wallets.attack).toBeLessThan(gifted.wallets.attack);
    expect(seen(play(painted, TAKE_BACK))).toEqual(seen(gifted));
  });

  it("takes back an eraser drag, Erases and Dismisses alike, with each Dude in its place", () => {
    const painted = play(attacking, ...stroke(50, 4, 4));
    const drag = nextEraserDrag(painted);
    const fresh = painted.army.length - 2;
    // An older Dude is Dismissed in the same drag as two fresh ones are Erased.
    const erased = play(
      painted,
      { type: "erase-dude", index: fresh + 1, drag },
      { type: "erase-dude", index: fresh, drag },
      { type: "erase-dude", index: 0, drag },
    );
    expect(erased.army).toHaveLength(painted.army.length - 3);
    expect(nextTakeBack(erased)).toEqual({
      kind: "eraser-drag",
      drag,
      dudes: 3,
    });
    expect(seen(play(erased, TAKE_BACK))).toEqual(seen(painted));
  });

  it("keeps two eraser drags apart", () => {
    const painted = play(attacking, ...stroke(50, 4, 4));
    const first = play(painted, {
      type: "erase-dude",
      index: 0,
      drag: nextEraserDrag(painted),
    });
    const second = play(first, {
      type: "erase-dude",
      index: 0,
      drag: nextEraserDrag(first),
    });
    expect(seen(play(second, TAKE_BACK))).toEqual(seen(first));
  });

  it("puts a picked Mutation back into the crate", () => {
    const start = offering(attacking, [
      { kind: "mutation", id: "giant" },
      { kind: "gift", id: "intern" },
    ]);
    const picked = play(start, { type: "take-from-crate", index: 0 });
    expect(picked.mutations).toEqual(["giant"]);
    expect(seen(play(picked, TAKE_BACK))).toEqual(seen(start));
  });

  it("takes back a free Undo picked from a boss crate", () => {
    const start = offering(
      newRun(1),
      [{ kind: "free-undo" }, { kind: "piece", id: "crate-wall" }],
      2,
    );
    const picked = play(start, { type: "take-from-crate", index: 0 });
    expect(picked.freeUndos).toBe(1);
    expect(seen(play(picked, TAKE_BACK))).toEqual(seen(start));
  });

  it("puts a slider dragged before the battle back, with its price", () => {
    const start = newRun(1);
    const dragged = play(start, drag("brightness", 1));
    expect(nextTakeBack(dragged)).toEqual({
      kind: "slider",
      slider: "brightness",
    });
    expect(seen(play(dragged, TAKE_BACK))).toEqual(seen(start));
  });

  it("puts back every Piece a Window size drag crushed", () => {
    const built = play(
      rich(newRun(1)),
      drag("window-size", 2),
      wall(5, -2),
      wall(6, -1),
      wall(7, 15),
    );
    const closed = play(built, drag("window-size", 1));
    expect(closed.pieces).toHaveLength(1);
    expect(seen(play(closed, TAKE_BACK))).toEqual(seen(built));
  });

  it("puts back every Dude a Window size drag squeezed", () => {
    const painted = play(attacking, {
      type: "paint-dude",
      dudeKind: "intern",
      at: { x: 1.5, y: 0.5 },
      stroke: 50,
    });
    const squeezed = play(painted, drag("window-size", -1));
    expect(squeezed.army.at(-1)?.at).toEqual({ x: 1.5, y: 1.5 });
    expect(seen(play(squeezed, TAKE_BACK))).toEqual(seen(painted));
  });

  it("steps back one action per press, newest first, to the start of the Round", () => {
    const start = rich(newRun(1));
    const steps = [
      play(start, wall(5, 1)),
      play(start, wall(5, 1), drag("brightness", 1)),
      play(start, wall(5, 1), drag("brightness", 1), wall(6, 1)),
    ];
    let state = steps[2] ?? start;
    for (const expected of [steps[1], steps[0], start]) {
      state = play(state, TAKE_BACK);
      expect(seen(state)).toEqual(seen(expected ?? start));
    }
    expect(refusalOf(state, TAKE_BACK)).toBe("nothing-to-take-back");
  });

  it("survives a JSON round trip of the Run", () => {
    const painted = play(attacking, ...stroke(50, 4, 3));
    const copied = JSON.parse(JSON.stringify(painted)) as RunState;
    expect(seen(play(copied, TAKE_BACK))).toEqual(seen(attacking));
  });
});

describe("what Take back never goes past", () => {
  it("stops at a crate reroll", () => {
    const rerolled = play(rich(newRun(1)), wall(5, 1), {
      type: "reroll-crate",
    });
    expect(refusalOf(rerolled, TAKE_BACK)).toBe("nothing-to-take-back");
    const placed = play(rerolled, wall(6, 1));
    expect(seen(play(placed, TAKE_BACK))).toEqual(seen(rerolled));
  });

  it("stops at an Undo", () => {
    const undone = play(
      rich({ ...newRun(1), freeUndos: 1 }),
      drag("brightness", 1),
      { type: "undo", slider: "brightness", pieces: [], dudes: [] },
    );
    expect(refusalOf(undone, TAKE_BACK)).toBe("nothing-to-take-back");
  });

  it("is cleared when the battle starts, and stays clear after a Rewind", () => {
    const built = play(newRun(1), wall(5, 1));
    expect(refusalOf(play(built, START), TAKE_BACK)).toBe("wrong-phase");
    const rewound = play(finish(built, "attack"), { type: "continue" });
    expect(rewound.pieces).toEqual([]);
    expect(refusalOf(rewound, TAKE_BACK)).toBe("nothing-to-take-back");
  });

  it("never takes back a slider dragged mid-battle", () => {
    const fighting = play(newRun(1), START, drag("game-speed", 1, 60));
    expect(refusalOf(fighting, TAKE_BACK)).toBe("wrong-phase");
    const next = play(
      fighting,
      {
        type: "battle-finished",
        winner: "defense",
        earned: { defense: 0, attack: 0 },
        destroyed: [],
      },
      { type: "continue" },
    );
    expect(next.sliders["game-speed"]).toBe(1);
    expect(refusalOf(next, TAKE_BACK)).toBe("nothing-to-take-back");
  });
});
