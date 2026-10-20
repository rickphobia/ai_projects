import { describe, expect, it } from "vitest";
import { roundOneArmy } from "../../src/battle/army";
import { runBattle } from "../../src/battle/battle";
import { earthquake } from "../../src/battle/curses";
import { CURSE_IDS } from "../../src/catalog/curses";
import { DUDE_KINDS, paintRadius } from "../../src/catalog/dudes";
import { GOLD_RULES } from "../../src/catalog/gold-rules";
import { PIECES } from "../../src/catalog/pieces";
import { RUN_RULES } from "../../src/catalog/run-rules";
import { SPAWN_ZONE_COLUMNS } from "../../src/maze/board";
import {
  applyRunAction,
  battleSetupOf,
  curseOf,
  dudesUnder,
  giftLeft,
  newRun,
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

/** Gold every test battle reports earning; the economy's own rules are tested in economy. */
const EARNED = { defense: 7, attack: 3 };

/** Starts the Round's battle, runs it with the real battle module and reports the winner and the Pieces destroyed. */
function fight(state: RunState): RunState {
  const fighting = play(state, { type: "start-battle" });
  const { state: end, events } = runBattle(battleSetupOf(fighting));
  if (end.outcome === null) throw new Error("the battle never ended");
  return play(fighting, {
    type: "battle-finished",
    winner: end.outcome.winner,
    earned: EARNED,
    destroyed: events.flatMap((event) =>
      event.type === "piece-destroyed" ? [event.pieceTile] : [],
    ),
  });
}

/** Ends the Round's battle with `winner`, without running it. */
function finish(state: RunState, winner: "attack" | "defense"): RunState {
  return play(play(state, { type: "start-battle" }), {
    type: "battle-finished",
    winner,
    earned: EARNED,
    destroyed: [],
  });
}

function sniperNest(column: number, row: number): RunAction {
  return {
    type: "place-piece",
    tile: { column, row },
    pieceId: "sniper-nest",
  };
}

function paintIntern(x: number, y: number, stroke = 100): RunAction {
  return { type: "paint-dude", dudeKind: "intern", at: { x, y }, stroke };
}

/** Paints `count` Interns (20 unless given) across the Spawn zone from `row` down, as one Stroke. */
function paintInterns(row: number, count = 20): RunAction[] {
  const spacing = 2 * paintRadius("intern") + 0.01;
  const across = Math.floor(SPAWN_ZONE_COLUMNS / spacing);
  return Array.from({ length: count }, (_, index) =>
    paintIntern(
      0.1 + (index % across) * spacing,
      row + 0.1 + Math.floor(index / across) * spacing,
    ),
  );
}

const CONTINUE: RunAction = { type: "continue" };

/** Two Sniper Nests either side of the Goal's row hold off the Round 1 Army, but not 20 more Interns. */
const HOLDING_MAZE = [sniperNest(11, 5), sniperNest(11, 8)];

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
    expect(run.army).toEqual(roundOneArmy(7));
    expect(run.lives).toBe(RUN_RULES.startingLives);
    expect(run.score).toBe(0);
    expect(run.phase).toBe("building");
    expect(run.wallets).toEqual({
      defense: GOLD_RULES.startingDefenseGold,
      attack: GOLD_RULES.startingAttackGold,
    });
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

    const wonAttack = fight(play(attacking, ...paintInterns(6)));
    expect(wonAttack.phase).toBe("round-won");
    expect(wonAttack.score).toBe(2);

    const defending = play(wonAttack, CONTINUE);
    expect(roundOf(defending)).toBe(3);
    expect(sideOf(defending)).toBe("defense");
    // Nothing despawns: the Maze and the whole Army carry into Round 3.
    expect(defending.pieces).toHaveLength(HOLDING_MAZE.length);
    expect(defending.army.slice(0, attacking.army.length)).toEqual(
      attacking.army,
    );
    expect(defending.army.slice(attacking.army.length)).toHaveLength(20);
  });

  it("refuses Pieces on an Attack turn and painting on a Defense turn", () => {
    const defending = newRun(1);
    expect(refusalOf(defending, paintIntern(1, 6))).toBe("wrong-side");

    const attacking = play(fight(play(defending, ...HOLDING_MAZE)), CONTINUE);
    expect(refusalOf(attacking, sniperNest(12, 4))).toBe("wrong-side");
  });
});

describe("placing", () => {
  const attacking = play(fight(play(newRun(1), ...HOLDING_MAZE)), CONTINUE);

  it("paints one Dude at a spot with its kind, Stroke and Round, in paint order", () => {
    const painted = play(attacking, paintIntern(0.5, 6.5, 9));
    expect(painted.army).toHaveLength(attacking.army.length + 1);
    expect(painted.army.at(-1)).toEqual({
      dudeKind: "intern",
      at: { x: 0.5, y: 6.5 },
      stroke: 9,
      round: 2,
    });
  });

  it("refuses a Dude too close to another, by both their sizes", () => {
    const painted = play(attacking, paintIntern(0.5, 6.5));
    const spacing = 2 * paintRadius("intern");
    expect(refusalOf(painted, paintIntern(0.5 + spacing * 0.9, 6.5))).toBe(
      "no-room",
    );
    expect(refusalOf(painted, paintIntern(0.5 + spacing * 1.01, 6.5))).toBe(
      null,
    );
    const rich: RunState = {
      ...painted,
      wallets: { ...painted.wallets, attack: 1000 },
    };
    const ram: RunAction = {
      type: "paint-dude",
      dudeKind: "ram-crew",
      at: { x: 0.5 + spacing * 1.01, y: 6.5 },
      stroke: 100,
    };
    expect(refusalOf(rich, ram)).toBe("no-room");
  });

  it("refuses a Dude outside the Spawn zone", () => {
    expect(refusalOf(attacking, paintIntern(SPAWN_ZONE_COLUMNS, 5))).toBe(
      "not-spawn-zone",
    );
    expect(refusalOf(attacking, paintIntern(12.5, 5))).toBe("not-spawn-zone");
    expect(refusalOf(attacking, paintIntern(1, -0.1))).toBe("not-spawn-zone");
    expect(refusalOf(attacking, paintIntern(1, 14))).toBe("not-spawn-zone");
  });

  it("sells a Dude kind once the best Score has Unlocked it", () => {
    const sapper: RunAction = {
      type: "paint-dude",
      dudeKind: "sapper",
      at: { x: 1, y: 6.5 },
      stroke: 100,
    };
    expect(refusalOf({ ...attacking, bestScore: 5 }, sapper)).toBeNull();
  });

  it("refuses a kind not on sale unless a gift holds it", () => {
    const sapper: RunAction = {
      type: "paint-dude",
      dudeKind: "sapper",
      at: { x: 1, y: 6.5 },
      stroke: 100,
    };
    expect(DUDE_KINDS.sapper.unlockScore).not.toBeNull();
    expect(refusalOf(attacking, sapper)).toBe("not-on-sale");
    expect(refusalOf(withGift(attacking, "sapper"), sapper)).toBeNull();
  });

  it("paints until the Attack gold runs out, then refuses", () => {
    const gold = attacking.wallets.attack;
    const strokes = paintInterns(6, gold + 1);
    const affordable = play(attacking, ...strokes.slice(0, gold));
    expect(affordable.wallets.attack).toBe(0);
    expect(affordable.army).toHaveLength(attacking.army.length + gold);
    const last = strokes[gold];
    if (last === undefined) throw new Error("no extra Dude to paint");
    expect(refusalOf(affordable, last)).toBe("not-enough-gold");
  });

  it("refuses painting during a battle", () => {
    const fighting = play(attacking, { type: "start-battle" });
    expect(refusalOf(fighting, paintIntern(1, 6.5))).toBe("wrong-phase");
  });

  it("passes on the Maze's own refusals, a Piece in the Spawn zone among them", () => {
    const run = play(newRun(1), sniperNest(9, 2));
    expect(refusalOf(run, sniperNest(9, 2))).toBe("tile-taken");
    for (let column = 0; column < SPAWN_ZONE_COLUMNS; column++) {
      expect(refusalOf(run, sniperNest(column, 2))).toBe("spawn-zone");
    }
  });
});

describe("wallets", () => {
  const attacking = play(fight(play(newRun(1), ...HOLDING_MAZE)), CONTINUE);
  const nestPrice = PIECES["sniper-nest"].price;
  const internPrice = DUDE_KINDS.intern.dudePrice;

  it("pays for a Piece from Defense gold only", () => {
    const run = newRun(1);
    const placed = play(run, sniperNest(9, 2));
    expect(placed.wallets).toEqual({
      defense: run.wallets.defense - nestPrice,
      attack: run.wallets.attack,
    });
  });

  it("pays for each painted Dude from Attack gold only", () => {
    const placed = play(attacking, ...paintInterns(0, 3));
    expect(placed.wallets).toEqual({
      defense: attacking.wallets.defense,
      attack: attacking.wallets.attack - 3 * internPrice,
    });
  });

  it("refuses a Piece Defense gold can't pay for, however much Attack gold there is", () => {
    const run: RunState = {
      ...newRun(1),
      wallets: { defense: nestPrice - 1, attack: 1000 },
    };
    expect(refusalOf(run, sniperNest(9, 2))).toBe("not-enough-gold");
  });

  it("refuses a Dude Attack gold can't pay for, however much Defense gold there is", () => {
    const run: RunState = {
      ...attacking,
      wallets: { defense: 1000, attack: internPrice - 1 },
    };
    expect(refusalOf(run, paintIntern(0.5, 0.5))).toBe("not-enough-gold");
  });

  it("keeps what a won battle earned, into the next Round's start", () => {
    const built = play(newRun(1), ...HOLDING_MAZE);
    const won = finish(built, "defense");
    const expected = {
      defense: built.wallets.defense + EARNED.defense,
      attack: built.wallets.attack + EARNED.attack,
    };
    expect(won.wallets).toEqual(expected);
    expect(won.roundStart.wallets).toEqual(expected);
  });

  it("Rewinds both wallets to the start of the Round and adds the Rewind bonus to the side played", () => {
    const spent = play(attacking, ...paintInterns(0));
    const lost = finish(spent, "defense");
    expect(lost.wallets).toEqual({
      defense: attacking.wallets.defense,
      attack: attacking.wallets.attack + GOLD_RULES.rewindBonus,
    });

    // A second loss Rewinds to the gold after the first, bonus included, and adds another.
    const lostAgain = finish(
      play(lost, CONTINUE, ...paintInterns(0)),
      "defense",
    );
    expect(lostAgain.wallets.attack).toBe(
      attacking.wallets.attack + 2 * GOLD_RULES.rewindBonus,
    );
  });

  it("refuses placing during a battle and fighting twice", () => {
    const fighting = play(newRun(1), { type: "start-battle" });
    expect(refusalOf(fighting, sniperNest(9, 2))).toBe("wrong-phase");
    expect(refusalOf(fighting, { type: "start-battle" })).toBe("wrong-phase");
  });

  it("refuses a battle result outside a battle, and continuing mid-Round", () => {
    const run = newRun(1);
    expect(
      refusalOf(run, {
        type: "battle-finished",
        winner: "defense",
        earned: EARNED,
        destroyed: [],
      }),
    ).toBe("wrong-phase");
    expect(refusalOf(run, CONTINUE)).toBe("wrong-phase");
    expect(refusalOf(run, { type: "new-run" })).toBe("wrong-phase");
  });
});

describe("losing a Round", () => {
  it("costs a Life and Rewinds the Board and Army to the start of the Round, keeping the Round number", () => {
    const attacking = play(fight(play(newRun(1), ...HOLDING_MAZE)), CONTINUE);
    const roundStart = { pieces: attacking.pieces, army: attacking.army };

    const lost = finish(play(attacking, ...paintInterns(0)), "defense");

    expect(lost.phase).toBe("round-lost");
    expect(lost.lives).toBe(RUN_RULES.startingLives - 1);
    expect({ pieces: lost.pieces, army: lost.army }).toEqual(roundStart);

    const retry = play(lost, CONTINUE);
    expect(roundOf(retry)).toBe(2);
    expect(sideOf(retry)).toBe("attack");
  });

  it("replays a Rewound Round with the same battle seed", () => {
    const run = play(newRun(1), ...HOLDING_MAZE);
    const lost = finish(run, "attack");
    const retry = play(lost, CONTINUE, ...HOLDING_MAZE);
    expect(battleSetupOf(retry).seed).toBe(battleSetupOf(run).seed);
  });
});

describe("Pieces a Wall-breaker destroys", () => {
  const nest = { column: 11, row: 5 };

  function finishDestroyingNest(
    state: RunState,
    winner: "attack" | "defense",
  ): RunState {
    return play(play(state, { type: "start-battle" }), {
      type: "battle-finished",
      winner,
      earned: EARNED,
      destroyed: [nest],
    });
  }

  it("stay gone after a won Round, so the Board never resets", () => {
    const won = finishDestroyingNest(
      play(newRun(1), ...HOLDING_MAZE),
      "defense",
    );
    expect(won.pieces.map(({ tile }) => tile)).toEqual([
      { column: 11, row: 8 },
    ]);
    expect(battleSetupOf(play(won, CONTINUE)).maze.pieces.size).toBe(1);
  });

  it("come back when a lost Round is Rewound", () => {
    const attacking = play(
      finish(play(newRun(1), ...HOLDING_MAZE), "defense"),
      CONTINUE,
    );
    const lost = finishDestroyingNest(attacking, "defense");
    expect(lost.phase).toBe("round-lost");
    expect(lost.pieces).toEqual(attacking.pieces);
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
    // Attacking with no new Dudes loses to the Maze that just held.
    const over = loseEveryLife(won);
    expect(over.phase).toBe("run-over");
    expect(over.lives).toBe(0);
    expect(over.score).toBe(1);
    expect(over.bestScore).toBe(1);
    expect(refusalOf(over, paintIntern(1, 6.5))).toBe("wrong-phase");
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

    expect(firstRun.firstRun).toBe(true);
    expect(secondRun.firstRun).toBe(false);

    // A worse Run doesn't lower it.
    const worse = loseEveryLife(secondRun);
    expect(worse.score).toBe(0);
    expect(worse.bestScore).toBe(1);
  });
});

/** `state` with a crate offering a gift of `dudeKind`, taken. */
function withGift(
  state: RunState,
  dudeKind: "intern" | "sapper" | "termite",
): RunState {
  return play(
    {
      ...state,
      crate: {
        kind: "draft",
        items: [{ kind: "gift", id: dudeKind }],
        picks: 1,
        rerolls: 0,
      },
    },
    { type: "take-from-crate", index: 0 },
  );
}

describe("crate gifts", () => {
  const attacking = play(fight(play(newRun(1), ...HOLDING_MAZE)), CONTINUE);
  const giftSize = DUDE_KINDS.intern.giftSize;

  it("holds the kind's gift size of free Dudes", () => {
    const gifted = withGift(attacking, "intern");
    expect(gifted.freeItems).toEqual([
      { kind: "gift", id: "intern", left: giftSize },
    ]);
    expect(giftLeft(gifted, "intern")).toBe(giftSize);
    expect(giftLeft(gifted, "termite")).toBe(0);
  });

  it("uses the gift first, then gold", () => {
    const gifted = withGift(attacking, "intern");
    const painted = play(gifted, ...paintInterns(6, giftSize + 2));
    expect(painted.freeItems).toEqual([]);
    expect(painted.wallets.attack).toBe(
      attacking.wallets.attack - 2 * DUDE_KINDS.intern.dudePrice,
    );
    const half = play(gifted, ...paintInterns(6, 5));
    expect(giftLeft(half, "intern")).toBe(giftSize - 5);
    expect(half.wallets).toEqual(attacking.wallets);
  });

  it("charges gold for other kinds while a gift waits", () => {
    const gifted = withGift(attacking, "termite");
    const painted = play(gifted, paintIntern(1, 6.5));
    expect(giftLeft(painted, "termite")).toBe(DUDE_KINDS.termite.giftSize);
    expect(painted.wallets.attack).toBe(
      attacking.wallets.attack - DUDE_KINDS.intern.dudePrice,
    );
  });

  it("loses an unused gift when the Round ends, won or lost", () => {
    const gifted = play(withGift(attacking, "intern"), ...paintInterns(6, 3));
    expect(finish(gifted, "attack").freeItems).toEqual([]);
    expect(finish(gifted, "defense").freeItems).toEqual([]);
  });
});

describe("erasing", () => {
  const attacking = play(fight(play(newRun(1), ...HOLDING_MAZE)), CONTINUE);
  const erase = (index: number): RunAction => ({ type: "erase-dude", index });

  it("Erases a Dude painted this Round for its full price back", () => {
    const painted = play(attacking, ...paintInterns(6, 3));
    const erased = play(painted, erase(painted.army.length - 2));
    expect(erased.army).toEqual([
      ...painted.army.slice(0, -2),
      painted.army.at(-1),
    ]);
    expect(erased.wallets.attack).toBe(
      painted.wallets.attack + DUDE_KINDS.intern.dudePrice,
    );
  });

  it("gives an Erased gift Dude back to the gift, even once the gift ran out", () => {
    const giftSize = DUDE_KINDS.intern.giftSize;
    const used = play(
      withGift(attacking, "intern"),
      ...paintInterns(6, giftSize + 1),
    );
    const paidIndex = used.army.length - 1;
    const backInGift = play(used, erase(paidIndex - giftSize));
    expect(giftLeft(backInGift, "intern")).toBe(1);
    expect(backInGift.wallets).toEqual(used.wallets);
    // The paid Dude, now one place earlier, still refunds gold.
    const refunded = play(backInGift, erase(paidIndex - 1));
    expect(refunded.wallets.attack).toBe(attacking.wallets.attack);
    expect(giftLeft(refunded, "intern")).toBe(1);
  });

  it("finds the Dudes under the eraser, in Army order", () => {
    const painted = play(
      attacking,
      paintIntern(0.5, 6.5),
      paintIntern(2.5, 6.5),
    );
    const first = painted.army.length - 2;
    expect(dudesUnder(painted.army, { x: 0.5, y: 6.5 })).toEqual([first]);
    expect(dudesUnder(painted.army, { x: 2.5, y: 6.6 })).toEqual([first + 1]);
    expect(dudesUnder(painted.army, { x: 1.5, y: 6.5 })).toEqual([]);
  });

  it("Dismisses a Dude from an earlier Round for nothing", () => {
    const dismissed = play(attacking, erase(0));
    expect(dismissed.army).toEqual(attacking.army.slice(1));
    expect(dismissed.wallets).toEqual(attacking.wallets);
    expect(dismissed.freeItems).toEqual(attacking.freeItems);
  });

  it("refuses outside an Attack turn's building phase, and for no such Dude", () => {
    expect(refusalOf(newRun(1), erase(0))).toBe("wrong-side");
    const fighting = play(attacking, { type: "start-battle" });
    expect(refusalOf(fighting, erase(0))).toBe("wrong-phase");
    expect(refusalOf(attacking, erase(attacking.army.length))).toBe("no-dude");
  });

  it("is undone by the Rewind after a lost Round", () => {
    const changed = play(
      attacking,
      ...paintInterns(6, 3),
      erase(attacking.army.length),
      erase(0),
    );
    const lost = finish(changed, "defense");
    expect(lost.army).toEqual(attacking.army);
    expect(lost.wallets.attack).toBe(
      attacking.wallets.attack + GOLD_RULES.rewindBonus,
    );
  });
});

describe("Curses", () => {
  it("rolls none in Round 1, then one per Round from the seed", () => {
    const run = newRun(1);
    expect(curseOf(run)).toBeNull();
    const roundTwo = finish(run, "defense");
    expect(curseOf(roundTwo)).not.toBeNull();
    expect(battleSetupOf(roundTwo).curse).toBe(curseOf(roundTwo));
    expect(curseOf(finish(newRun(1), "defense"))).toBe(curseOf(roundTwo));
  });

  it("rolls every Curse across seeds", () => {
    const rolled = new Set(
      Array.from({ length: 200 }, (_, seed) =>
        curseOf(finish(newRun(seed), "defense")),
      ),
    );
    expect([...rolled].sort()).toEqual([...CURSE_IDS].sort());
  });

  it("keeps the same Curse after a Rewind", () => {
    const roundTwo = play(finish(newRun(1), "defense"), { type: "continue" });
    const rewound = finish(roundTwo, "defense");
    expect(rewound.phase).toBe("round-lost");
    expect(curseOf(rewound)).toBe(curseOf(roundTwo));
  });

  it("removes the Piece an Earthquake moved when a Wall-breaker destroys it", () => {
    const seed = Array.from({ length: 500 }, (_, at) => at).find(
      (at) => curseOf(finish(newRun(at), "defense")) === "earthquake",
    );
    if (seed === undefined) throw new Error("no seed rolls an Earthquake");
    const walls = [5, 6, 7].map((row) => ({
      pieceId: "crate-wall" as const,
      tile: { column: 10, row },
    }));
    const fighting = play(
      { ...finish(newRun(seed), "defense"), pieces: walls },
      { type: "continue" },
      { type: "start-battle" },
    );
    const setup = battleSetupOf(fighting);
    const quake = earthquake(setup.maze, setup.seed);
    if (quake === null) throw new Error("a wall must be able to move");
    const won = play(fighting, {
      type: "battle-finished",
      winner: "attack",
      earned: EARNED,
      destroyed: [quake.to],
    });
    expect(won.pieces.map(({ tile }) => tile)).not.toContainEqual(quake.from);
    expect(won.pieces).toHaveLength(2);
  });
});
