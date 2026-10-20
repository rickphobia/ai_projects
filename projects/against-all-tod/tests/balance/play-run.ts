import type { Side } from "../../src/battle/battle";
import { runBattle } from "../../src/battle/battle";
import { destroyedForGood } from "../../src/battle/bosses";
import type { BossId } from "../../src/catalog/bosses";
import type { CurseId } from "../../src/catalog/curses";
import { goldEarned } from "../../src/economy/economy";
import {
  applyRunAction,
  battleSetupOf,
  bossOf,
  curseOf,
  newRun,
  roundOf,
  sideOf,
  type RunAction,
  type RunState,
} from "../../src/run/run";

/**
 * Plays whole Runs headless, the way the screen does, with a fixed strategy for each side. The
 * balance check reads what happened Round by Round.
 */

/** A side's building turn: takes the state at the start of the turn and returns it ready to fight. */
export type Strategy = (state: RunState) => RunState;

export interface Strategies {
  readonly defense: Strategy;
  readonly attack: Strategy;
}

/** One battle fought: a Round won, or a Round lost and Rewound to be played again. */
export interface BattlePlayed {
  readonly round: number;
  readonly side: Side;
  readonly won: boolean;
  readonly curse: CurseId | null;
  readonly boss: BossId | null;
  readonly pieces: number;
  readonly dudes: number;
}

export interface RunPlayed {
  readonly seed: number;
  readonly battles: readonly BattlePlayed[];
  /** The Round being played when the Run stopped: past `lastRound`, or where the last Life went. */
  readonly endRound: number;
  readonly livesLeft: number;
}

/** Applies an action the strategy is sure of, failing loudly if the Run refuses it. */
export function act(state: RunState, action: RunAction): RunState {
  const result = applyRunAction(state, action);
  if (!result.ok) {
    throw new Error(
      `Round ${String(roundOf(state))}: ${action.type} refused: ${result.refusal}`,
    );
  }
  return result.state;
}

/** Plays from a new Run on `seed` until Round `lastRound` is won or the last Life is lost. */
export function playRun(
  seed: number,
  strategies: Strategies,
  lastRound: number,
): RunPlayed {
  let state = newRun(seed);
  const battles: BattlePlayed[] = [];
  while (state.phase !== "run-over" && roundOf(state) <= lastRound) {
    const side = sideOf(state);
    const built = strategies[side](state);
    const played: BattlePlayed = {
      round: roundOf(built),
      side,
      won: false,
      curse: curseOf(built),
      boss: bossOf(built),
      pieces: built.pieces.length,
      dudes: built.army.length,
    };
    state = fight(act(built, { type: "start-battle" }));
    battles.push({ ...played, won: state.phase === "round-won" });
    if (state.phase !== "run-over") state = act(state, { type: "continue" });
  }
  return {
    seed,
    battles,
    endRound: roundOf(state),
    livesLeft: state.lives,
  };
}

/** Runs the Round's battle with the real battle module and reports it as the screen does. */
function fight(state: RunState): RunState {
  const setup = battleSetupOf(state);
  const { state: end, events } = runBattle(setup);
  if (end.outcome === null) throw new Error("the battle never ended");
  const goldEvents = events.filter((event) => event.type !== "shot");
  return act(state, {
    type: "battle-finished",
    winner: end.outcome.winner,
    earned: goldEarned(goldEvents, {
      winner: end.outcome.winner,
      goalHealth: end.goalHealth,
      survivors: end.dudes.map((dude) => dude.kind),
      mutations: setup.mutations,
    }),
    destroyed: destroyedForGood(goldEvents),
  });
}

/** One line per battle, for a failing check's message and for tuning by hand. */
export function describeRun(run: RunPlayed): string {
  const battles = run.battles.map((battle) => {
    const details = [
      `${String(battle.pieces)} Pieces`,
      `${String(battle.dudes)} Dudes`,
      ...(battle.curse === null ? [] : [battle.curse]),
      ...(battle.boss === null ? [] : [battle.boss]),
    ];
    const result = battle.won ? "won" : "lost";
    return `R${String(battle.round)} ${battle.side} ${result} (${details.join(", ")})`;
  });
  return [`seed ${String(run.seed)}:`, ...battles].join("\n  ");
}
