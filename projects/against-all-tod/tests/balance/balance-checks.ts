import { beforeAll, describe, expect, it } from "vitest";
import { describeRun, playRun, type RunPlayed } from "./play-run";
import { BASIC } from "./strategies";

/**
 * Balance smoke test: a seeded Run played by the basic strategies, headless, to Round 10. It
 * checks bounds that a change making one side unbeatable breaks, not exact results, so ordinary
 * retuning passes. A failure prints the Run battle by battle. Each seed has its own test file so
 * Vitest plays them in parallel.
 */

const LAST_ROUND = 10;
/** The basic Army must break the basic Maze by this Round. */
const ATTACK_WINS_BY = 4;
/** Round 1's Army is game-made; the basic Maze must hold a painted one from Round 3 on. */
const FIRST_PAINTED_DEFENSE = 3;
/** Neither side may be so far ahead that the Run is lost in its first Rounds. */
const RUN_LASTS_PAST = 4;

/** A Run takes up to a minute or two on a slow machine; the default timeout is for unit tests. */
const PLAY_TIMEOUT_MS = 300_000;

export function checkBalance(seed: number): void {
  describe(`balance with the basic strategies, seed ${String(seed)}`, () => {
    let run: RunPlayed | null = null;
    const played = (): RunPlayed => {
      if (run === null) throw new Error("the Run was not played");
      return run;
    };

    beforeAll(() => {
      run = playRun(seed, BASIC, LAST_ROUND);
    }, PLAY_TIMEOUT_MS);

    it(`a basic Army breaks a basic Maze by Round ${String(ATTACK_WINS_BY)}`, () => {
      const broke = played().battles.some(
        (battle) =>
          battle.side === "attack" &&
          battle.won &&
          battle.round <= ATTACK_WINS_BY,
      );
      expect(broke, describeRun(played())).toBe(true);
    });

    it("a basic Maze holds a basic Army at least once", () => {
      const held = played().battles.some(
        (battle) =>
          battle.side === "defense" &&
          battle.won &&
          battle.round >= FIRST_PAINTED_DEFENSE,
      );
      expect(held, describeRun(played())).toBe(true);
    });

    it(`the Run is not lost before Round ${String(RUN_LASTS_PAST + 1)}`, () => {
      expect(played().endRound, describeRun(played())).toBeGreaterThan(
        RUN_LASTS_PAST,
      );
    });
  });
}
