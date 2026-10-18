import { describe, expect, it } from "vitest";
import { runBattle } from "../../src/battle/battle";
import { ROUND_ONE_ARMY } from "../../src/catalog/dudes";
import { RUN_RULES } from "../../src/catalog/run-rules";
import { BOARD_ROWS } from "../../src/maze/board";
import {
  applyRunAction,
  battleSetupOf,
  newRun,
  placementsLeft,
  roundOf,
  sideOf,
  type RunAction,
  type RunState,
} from "../../src/run/run";

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

/** Starts the Round's battle, runs it with the real battle module and reports the winner. */
function fight(state: RunState): RunState {
  const fighting = play(state, { type: "start-battle" });
  const outcome = runBattle(battleSetupOf(fighting)).state.outcome;
  if (outcome === null) throw new Error("the battle never ended");
  return play(fighting, { type: "battle-finished", winner: outcome.winner });
}

function sniperNest(column: number, row: number): RunAction {
  return {
    type: "place-piece",
    tile: { column, row },
    pieceId: "sniper-nest",
  };
}

function internSquad(spawnRow: number): RunAction {
  return { type: "place-squad", spawnRow, dudeKind: "intern" };
}

const CONTINUE: RunAction = { type: "continue" };

/** Two Sniper Nests in the middle hold off the Round 1 Army, but not one more Squad of Interns. */
const HOLDING_MAZE = [sniperNest(9, 2), sniperNest(9, 3)];
/** A third Sniper Nest also holds off the Round 1 Army plus one more Squad. */
const STRONG_MAZE = [...HOLDING_MAZE, sniperNest(9, 4)];

function refusalOf(state: RunState, action: RunAction) {
  const result = applyRunAction(state, action);
  return result.ok ? null : result.refusal;
}

describe("a new Run", () => {
  it("starts on Round 1, a Defense turn, with an empty Board, the game-made Army and full Lives", () => {
    const run = newRun(7);
    expect(roundOf(run)).toBe(1);
    expect(sideOf(run)).toBe("defense");
    expect(run.pieces).toEqual([]);
    expect(run.army).toEqual(ROUND_ONE_ARMY);
    expect(run.lives).toBe(RUN_RULES.startingLives);
    expect(run.score).toBe(0);
    expect(run.phase).toBe("building");
  });

  it("is plain data that survives a JSON round trip", () => {
    const run = play(newRun(7), ...HOLDING_MAZE);
    expect(JSON.parse(JSON.stringify(run))).toEqual(run);
  });
});

describe("switching sides", () => {
  it("attacks the Maze it built after winning a Defense turn, and defends again after winning that", () => {
    const wonDefense = fight(play(newRun(1), ...HOLDING_MAZE));
    expect(wonDefense.phase).toBe("round-won");
    expect(wonDefense.score).toBe(1);

    const attacking = play(wonDefense, CONTINUE);
    expect(roundOf(attacking)).toBe(2);
    expect(sideOf(attacking)).toBe("attack");

    const wonAttack = fight(play(attacking, internSquad(6)));
    expect(wonAttack.phase).toBe("round-won");
    expect(wonAttack.score).toBe(2);

    const defending = play(wonAttack, CONTINUE);
    expect(roundOf(defending)).toBe(3);
    expect(sideOf(defending)).toBe("defense");
    // Nothing despawns: the Maze and the whole Army carry into Round 3.
    expect(defending.pieces).toHaveLength(HOLDING_MAZE.length);
    expect(defending.army).toEqual([
      ...ROUND_ONE_ARMY,
      { dudeKind: "intern", spawnRow: 6 },
    ]);
  });

  it("refuses Pieces on an Attack turn and Squads on a Defense turn", () => {
    const defending = newRun(1);
    expect(refusalOf(defending, internSquad(6))).toBe("wrong-side");

    const attacking = play(fight(play(defending, ...HOLDING_MAZE)), CONTINUE);
    expect(refusalOf(attacking, sniperNest(12, 4))).toBe("wrong-side");
  });
});

describe("placing", () => {
  const attacking = play(fight(play(newRun(1), ...HOLDING_MAZE)), CONTINUE);

  it("puts a Squad on one Spawn line tile and refuses a second Squad there", () => {
    const placed = play(attacking, internSquad(0));
    expect(placed.army.at(-1)).toEqual({ dudeKind: "intern", spawnRow: 0 });
    expect(refusalOf(placed, internSquad(0))).toBe("tile-taken");
    for (const { spawnRow } of ROUND_ONE_ARMY) {
      expect(refusalOf(attacking, internSquad(spawnRow))).toBe("tile-taken");
    }
  });

  it("refuses a Squad off the Spawn line", () => {
    expect(refusalOf(attacking, internSquad(BOARD_ROWS))).toBe("off-board");
    expect(refusalOf(attacking, internSquad(-1))).toBe("off-board");
  });

  it("passes on the Maze's own refusals", () => {
    const run = play(newRun(1), sniperNest(9, 2));
    expect(refusalOf(run, sniperNest(9, 2))).toBe("tile-taken");
    expect(refusalOf(run, sniperNest(0, 2))).toBe("spawn-line");
  });

  it("allows only so many Pieces in a Defense turn", () => {
    const actions = Array.from(
      { length: RUN_RULES.piecesPerDefenseTurn },
      (_, index) => sniperNest(9, index),
    );
    const full = play(newRun(1), ...actions);
    expect(placementsLeft(full)).toBe(0);
    expect(refusalOf(full, sniperNest(12, 0))).toBe("none-left");
  });

  it("allows only so many Squads in an Attack turn", () => {
    const rows = [0, 1, 2, 4, 5, 6].slice(0, RUN_RULES.squadsPerAttackTurn);
    const full = play(attacking, ...rows.map(internSquad));
    expect(placementsLeft(full)).toBe(0);
    expect(refusalOf(full, internSquad(13))).toBe("none-left");
  });

  it("refuses placing during a battle and fighting twice", () => {
    const fighting = play(newRun(1), { type: "start-battle" });
    expect(refusalOf(fighting, sniperNest(9, 2))).toBe("wrong-phase");
    expect(refusalOf(fighting, { type: "start-battle" })).toBe("wrong-phase");
  });

  it("refuses a battle result outside a battle, and continuing mid-Round", () => {
    const run = newRun(1);
    expect(refusalOf(run, { type: "battle-finished", winner: "defense" })).toBe(
      "wrong-phase",
    );
    expect(refusalOf(run, CONTINUE)).toBe("wrong-phase");
    expect(refusalOf(run, { type: "new-run" })).toBe("wrong-phase");
  });
});

describe("losing a Round", () => {
  it("costs a Life and Rewinds the Board and Army to the start of the Round, keeping the Round number", () => {
    const attacking = play(fight(play(newRun(1), ...STRONG_MAZE)), CONTINUE);
    const roundStart = { pieces: attacking.pieces, army: attacking.army };

    const lost = fight(play(attacking, internSquad(0)));

    expect(lost.phase).toBe("round-lost");
    expect(lost.lives).toBe(RUN_RULES.startingLives - 1);
    expect({ pieces: lost.pieces, army: lost.army }).toEqual(roundStart);

    const retry = play(lost, CONTINUE);
    expect(roundOf(retry)).toBe(2);
    expect(sideOf(retry)).toBe("attack");
    expect(placementsLeft(retry)).toBe(RUN_RULES.squadsPerAttackTurn);
  });

  it("replays a Rewound Round with the same battle seed", () => {
    const run = play(newRun(1), ...HOLDING_MAZE);
    const lost = play(play(run, { type: "start-battle" }), {
      type: "battle-finished",
      winner: "attack",
    });
    const retry = play(lost, CONTINUE, ...HOLDING_MAZE);
    expect(battleSetupOf(retry).seed).toBe(battleSetupOf(run).seed);
  });
});

describe("the end of a Run", () => {
  /** An empty Board loses Round 1 every time. */
  function loseEveryLife(run: RunState): RunState {
    let state = fight(run);
    while (state.phase === "round-lost") state = fight(play(state, CONTINUE));
    return state;
  }

  it("ends at zero Lives with the Score kept as the best Score", () => {
    const won = play(fight(play(newRun(1), ...HOLDING_MAZE)), CONTINUE);
    // Attacking with no new Squads loses to the Maze that just held.
    const over = loseEveryLife(won);
    expect(over.phase).toBe("run-over");
    expect(over.lives).toBe(0);
    expect(over.score).toBe(1);
    expect(over.bestScore).toBe(1);
    expect(refusalOf(over, internSquad(6))).toBe("wrong-phase");
  });

  it("starts a new Run in one action, keeping the best Score of the session", () => {
    const firstRun = loseEveryLife(
      play(fight(play(newRun(1), ...HOLDING_MAZE)), CONTINUE),
    );
    const secondRun = play(firstRun, { type: "new-run" });
    expect(secondRun.phase).toBe("building");
    expect(roundOf(secondRun)).toBe(1);
    expect(secondRun.lives).toBe(RUN_RULES.startingLives);
    expect(secondRun.pieces).toEqual([]);
    expect(secondRun.bestScore).toBe(1);

    // A worse Run doesn't lower it.
    const worse = loseEveryLife(secondRun);
    expect(worse.score).toBe(0);
    expect(worse.bestScore).toBe(1);
  });
});
