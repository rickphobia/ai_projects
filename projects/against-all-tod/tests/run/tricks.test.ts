import { describe, expect, it } from "vitest";
import { runBattle, startBattle } from "../../src/battle/battle";
import { GOLD_RULES } from "../../src/catalog/gold-rules";
import { SLIDERS, TRICK_RULES, type SliderId } from "../../src/catalog/tricks";
import {
  applyRunAction,
  battleSetupOf,
  currentSliders,
  newRun,
  sideOf,
  type RunAction,
  type RunState,
} from "../../src/run/run";
import { NEUTRAL_SLIDERS } from "../../src/tricks/tricks";

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

function drag(slider: SliderId, to: number, atStep = 0) {
  return { type: "drag-slider", slider, to, atStep } as const;
}

function finish(state: RunState, winner: "attack" | "defense"): RunState {
  return play(state, {
    type: "battle-finished",
    winner,
    earned: { defense: 0, attack: 0 },
    destroyed: [],
  });
}

const BRIGHT_STEP = SLIDERS.brightness.stepPrice;
const START = { type: "start-battle" } as const;

describe("dragging a slider between battles", () => {
  it("moves it and charges the side being played the step price", () => {
    const run = newRun(1);
    expect(sideOf(run)).toBe("defense");
    const dragged = play(run, drag("brightness", 1));
    expect(dragged.sliders.brightness).toBe(1);
    expect(dragged.wallets).toEqual({
      defense: GOLD_RULES.startingDefenseGold - BRIGHT_STEP,
      attack: GOLD_RULES.startingAttackGold,
    });
  });

  it("charges the Attack wallet on an Attack turn, even for a step that helps defense", () => {
    const attacking = play(finish(play(newRun(1), START), "defense"), {
      type: "continue",
    });
    expect(sideOf(attacking)).toBe("attack");
    const dragged = play(attacking, drag("brightness", 1));
    expect(dragged.wallets.attack).toBe(attacking.wallets.attack - BRIGHT_STEP);
    expect(dragged.wallets.defense).toBe(attacking.wallets.defense);
  });

  it("charges double to move back toward the middle", () => {
    const dark = play(newRun(1), drag("brightness", -1));
    const back = play(dark, drag("brightness", 0));
    expect(back.wallets.defense).toBe(
      dark.wallets.defense - BRIGHT_STEP * TRICK_RULES.towardMiddleMultiplier,
    );
  });

  it("refuses a drag off the end, or one the wallet can't pay", () => {
    const run = newRun(1);
    expect(refusalOf(run, drag("brightness", 3))).toBe("slider-end");
    expect(refusalOf(run, drag("brightness", 0))).toBe("slider-end");
    const broke = {
      ...run,
      wallets: { defense: BRIGHT_STEP - 1, attack: 0 },
    };
    expect(refusalOf(broke, drag("brightness", 1))).toBe("not-enough-gold");
  });

  it("is refused once the Round is over", () => {
    const won = finish(play(newRun(1), START), "defense");
    expect(refusalOf(won, drag("brightness", 1))).toBe("wrong-phase");
  });
});

describe("dragging a slider mid-battle", () => {
  const fighting = play(newRun(1), START);

  it("costs double and is recorded as a timed input, not a new start position", () => {
    const dragged = play(fighting, drag("brightness", -1, 120));
    expect(dragged.wallets.defense).toBe(
      fighting.wallets.defense - BRIGHT_STEP * TRICK_RULES.midBattleMultiplier,
    );
    expect(dragged.sliders).toEqual(NEUTRAL_SLIDERS);
    expect(dragged.sliderInputs).toEqual([
      { step: 120, slider: "brightness", position: -1 },
    ]);
    expect(currentSliders(dragged).brightness).toBe(-1);
  });

  it("prices a second drag from where the first left the slider", () => {
    const once = play(fighting, drag("brightness", -1, 120));
    const back = play(once, drag("brightness", 0, 240));
    expect(back.wallets.defense).toBe(
      once.wallets.defense -
        BRIGHT_STEP *
          TRICK_RULES.towardMiddleMultiplier *
          TRICK_RULES.midBattleMultiplier,
    );
  });

  it("goes into the battle setup, so the battle replays the same from its seed", () => {
    const dragged = play(fighting, drag("game-speed", 2, 300));
    const setup = battleSetupOf(dragged);
    expect(setup.sliderInputs).toEqual(dragged.sliderInputs);
    expect(runBattle(setup)).toEqual(runBattle(battleSetupOf(dragged)));
  });

  it("stays after a won Round, with the inputs folded into the positions", () => {
    const dragged = play(fighting, drag("brightness", -1, 120));
    const won = finish(dragged, "defense");
    expect(won.sliders.brightness).toBe(-1);
    expect(won.roundStart.sliders.brightness).toBe(-1);
    expect(won.sliderInputs).toEqual([]);
  });

  it("is Rewound with the rest of the Round after a loss", () => {
    const before = play(newRun(1), drag("brightness", 1));
    const dragged = play(before, START, drag("brightness", 2, 60));
    const lost = finish(dragged, "attack");
    expect(lost.sliders).toEqual(NEUTRAL_SLIDERS);
    expect(lost.sliderInputs).toEqual([]);
  });
});

describe("the Window size trick", () => {
  const WINDOW_STEP = SLIDERS["window-size"].stepPrice;
  const wall = { type: "place-piece", pieceId: "crate-wall" } as const;
  const rich = (state: RunState): RunState => ({
    ...state,
    wallets: { defense: 10_000, attack: 10_000 },
  });
  const attacking = play(finish(play(newRun(1), START), "defense"), {
    type: "continue",
  });

  it("is priced like every other slider: a step away, double back toward the middle", () => {
    const bigger = play(newRun(1), drag("window-size", 1));
    expect(bigger.wallets.defense).toBe(
      GOLD_RULES.startingDefenseGold - WINDOW_STEP,
    );
    const back = play(bigger, drag("window-size", 0));
    expect(back.wallets.defense).toBe(
      bigger.wallets.defense - WINDOW_STEP * TRICK_RULES.towardMiddleMultiplier,
    );
    expect(refusalOf(newRun(1), drag("window-size", 3))).toBe("slider-end");
  });

  it("can't be dragged mid-battle, and charges nothing for trying", () => {
    expect(refusalOf(play(newRun(1), START), drag("window-size", 1, 60))).toBe(
      "wrong-phase",
    );
  });

  it("opens a lane a Piece can go on, and the battle's Maze has it", () => {
    const tile = { column: 5, row: -1 };
    expect(refusalOf(newRun(1), { ...wall, tile })).toBe("off-board");
    const built = play(newRun(1), drag("window-size", 1), { ...wall, tile });
    expect(built.pieces.map((piece) => piece.tile)).toEqual([tile]);
    expect(battleSetupOf(built).maze.windowSize).toBe(1);
  });

  it("crushes the Pieces on a lane when it closes again", () => {
    const built = play(
      rich(newRun(1)),
      drag("window-size", 2),
      { ...wall, tile: { column: 5, row: -2 } },
      { ...wall, tile: { column: 6, row: -1 } },
      { ...wall, tile: { column: 7, row: 15 } },
      drag("window-size", 1),
    );
    expect(built.pieces.map((piece) => piece.tile)).toEqual([
      { column: 6, row: -1 },
    ]);
  });

  it("is refused when closing a lane would cut the Spawn zone off from the Goal", () => {
    const rows = Array.from({ length: 14 }, (_, row) => row);
    const walled = play(
      rich(newRun(1)),
      drag("window-size", 1),
      ...rows.map((row) => ({ ...wall, tile: { column: 10, row } })),
    );
    expect(refusalOf(walled, drag("window-size", 0))).toBe("seals-goal");
  });

  it("squeezes Dudes into the nearest open row and fights from there", () => {
    const painted = play(attacking, {
      type: "paint-dude",
      dudeKind: "intern",
      at: { x: 1.5, y: 0.5 },
      stroke: 99,
    });
    const squeezed = play(painted, drag("window-size", -1));
    expect(squeezed.army.at(-1)?.at).toEqual({ x: 1.5, y: 1.5 });
    expect(squeezed.army).toHaveLength(painted.army.length);
    expect(
      refusalOf(squeezed, {
        type: "paint-dude",
        dudeKind: "intern",
        at: { x: 1.5, y: 0.5 },
        stroke: 100,
      }),
    ).toBe("not-spawn-zone");
    expect(() => startBattle(battleSetupOf(squeezed))).not.toThrow();
  });

  it("is Rewound with the Board and Army after a loss", () => {
    const squeezed = play(rich(attacking), drag("window-size", -2));
    const lost = finish(play(squeezed, START), "defense");
    expect(lost.sliders["window-size"]).toBe(0);
    expect(lost.army).toEqual(attacking.army);
  });
});
