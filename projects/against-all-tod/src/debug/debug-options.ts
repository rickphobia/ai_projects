import type { Side } from "../battle/battle";
import { addGold } from "../economy/economy";
import { withFreshCrate, type RunState } from "../run/run";

/**
 * Developer options read from the page URL: `?seed=<n>` starts a Run with that seed, and
 * `?debug=1` adds buttons to give gold, jump to a Round and toggle the route preview. The
 * changes they make to a Run are pure, so they are tested like the Run itself.
 */

const MAX_SEED = 2 ** 32 - 1;

/** The seed in `?seed=<n>`, or null when there is none or it isn't a whole number in range. */
export function seedFromUrl(search: string): number | null {
  const raw = new URLSearchParams(search).get("seed");
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const seed = Number(raw);
  return seed <= MAX_SEED ? seed : null;
}

export function wantsDebugOptions(search: string): boolean {
  return new URLSearchParams(search).get("debug") === "1";
}

/** Adds gold to one side's wallet, and to the Round's start so a Rewind keeps it. */
export function giveGold(
  state: RunState,
  side: Side,
  amount: number,
): RunState {
  const gift = { defense: 0, attack: 0, [side]: amount };
  return {
    ...state,
    wallets: addGold(state.wallets, gift),
    roundStart: {
      ...state.roundStart,
      wallets: addGold(state.roundStart.wallets, gift),
    },
  };
}

/**
 * Starts Round `round` with the Board, Army and wallets as they are and that Round's crate:
 * the Score becomes the Rounds before it. Not during a battle or after the Run is over.
 */
export function jumpToRound(state: RunState, round: number): RunState | null {
  if (state.phase === "fighting" || state.phase === "run-over") return null;
  if (!Number.isSafeInteger(round) || round < 1) return null;
  return withFreshCrate({
    ...state,
    score: round - 1,
    phase: "building",
    roundStart: {
      pieces: state.pieces,
      army: state.army,
      mutations: state.mutations,
      wallets: state.wallets,
      sliders: state.sliders,
      freeUndos: state.freeUndos,
    },
  });
}
