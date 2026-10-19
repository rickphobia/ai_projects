import type { Side } from "../battle/battle";
import { BOSS_RULES, BOSSES, type BossId } from "../catalog/bosses";

/**
 * When Boss Rounds come and which boss each has. Worked out from the Round alone, never stored,
 * so a Rewind brings the boss back and the Board and Army the Run keeps never hold it.
 */

/** Rounds 5, 10, 15… */
export function isBossRound(round: number): boolean {
  return round % BOSS_RULES.bossRoundEvery === 0;
}

/**
 * Whether `round` opens with a boss crate: the Round after a Boss Round, which can only be
 * reached by winning it. A Rewound Round keeps its crate.
 */
export function opensBossCrate(round: number): boolean {
  return round > 1 && isBossRound(round - 1);
}

/**
 * The boss that fights against the player in `round`, played on `side`: The Landlord on a
 * Defense turn, The HR Department on an Attack turn, null outside Boss Rounds.
 */
export function bossFor(round: number, side: Side): BossId | null {
  if (!isBossRound(round)) return null;
  const boss = Object.values(BOSSES).find(({ against }) => against === side);
  return boss?.id ?? null;
}
