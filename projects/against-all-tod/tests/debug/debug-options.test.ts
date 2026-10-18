import { describe, expect, it } from "vitest";
import {
  giveGold,
  jumpToRound,
  seedFromUrl,
  wantsDebugOptions,
} from "../../src/debug/debug-options";
import {
  applyRunAction,
  newRun,
  roundOf,
  sideOf,
  type RunAction,
  type RunState,
} from "../../src/run/run";

function play(state: RunState, ...actions: RunAction[]): RunState {
  return actions.reduce((current, action) => {
    const result = applyRunAction(current, action);
    if (!result.ok) throw new Error(`${action.type}: ${result.refusal}`);
    return result.state;
  }, state);
}

describe("seedFromUrl", () => {
  it("reads a whole-number seed", () => {
    expect(seedFromUrl("?seed=777")).toBe(777);
  });

  it.each([
    "",
    "?seed=",
    "?seed=-1",
    "?seed=1.5",
    "?seed=abc",
    "?seed=4294967296",
  ])("ignores %j", (search) => {
    expect(seedFromUrl(search)).toBeNull();
  });
});

describe("wantsDebugOptions", () => {
  it("needs debug=1", () => {
    expect(wantsDebugOptions("?debug=1")).toBe(true);
    expect(wantsDebugOptions("?debug=0")).toBe(false);
    expect(wantsDebugOptions("")).toBe(false);
  });
});

describe("the same seed and actions reproduce a Run", () => {
  it("gives equal states", () => {
    const actions: RunAction[] = [
      {
        type: "place-piece",
        tile: { column: 4, row: 4 },
        pieceId: "crate-wall",
      },
      { type: "start-battle" },
    ];
    expect(play(newRun(9), ...actions)).toEqual(play(newRun(9), ...actions));
  });
});

describe("giveGold", () => {
  it("adds to one wallet only, and to the Round's start so a Rewind keeps it", () => {
    const run = newRun(1);
    const richer = giveGold(run, "attack", 100);
    expect(richer.wallets).toEqual({
      ...run.wallets,
      attack: run.wallets.attack + 100,
    });
    expect(richer.roundStart.wallets).toEqual(richer.wallets);
  });
});

describe("jumpToRound", () => {
  it("starts Round N on its side, with the Board as it is", () => {
    const jumped = jumpToRound(newRun(1), 10);
    expect(jumped).not.toBeNull();
    if (jumped === null) return;
    expect(roundOf(jumped)).toBe(10);
    expect(sideOf(jumped)).toBe("attack");
    expect(jumped.phase).toBe("building");
  });

  it("refuses during a battle and for Rounds below 1", () => {
    const fighting = play(newRun(1), { type: "start-battle" });
    expect(jumpToRound(fighting, 5)).toBeNull();
    expect(jumpToRound(newRun(1), 0)).toBeNull();
    expect(jumpToRound(newRun(1), Number.NaN)).toBeNull();
  });
});
