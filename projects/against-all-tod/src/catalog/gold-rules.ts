/**
 * Tuning numbers for gold. Pure data: balancing the economy means changing a number here, and
 * tests read the numbers from here rather than copying them. A Dude's own worth is its kind's
 * `goldValue` in the Dude catalog, so bigger kinds pay more.
 */
export interface GoldRules {
  readonly startingDefenseGold: number;
  readonly startingAttackGold: number;
  /** Defense gold per kill, times the killed Dude's `goldValue`. */
  readonly perKill: number;
  /** Defense gold per point of Goal health left after a won Defense turn, rounded down. */
  readonly perGoalHealthLeft: number;
  /** Attack gold per Dude reaching the Goal, times its `goldValue`. */
  readonly perReachGoal: number;
  /** Attack gold per Dude still alive when the Goal breaks, times its `goldValue`. */
  readonly perSurvivor: number;
  /** Attack gold per Piece a Wall-breaker destroys. */
  readonly perPieceDestroyed: number;
  /** Gold moved from the Attack wallet to the Defense wallet per Dude crossing a Tax Booth. */
  readonly perTaxedDude: number;
  /** Added to the played side's wallet after a Rewind, so the retry is not the same fight. */
  readonly rewindBonus: number;
}

export const GOLD_RULES: GoldRules = {
  startingDefenseGold: 120,
  startingAttackGold: 40,
  perKill: 2,
  perGoalHealthLeft: 0.5,
  perReachGoal: 1,
  perSurvivor: 1,
  perPieceDestroyed: 10,
  perTaxedDude: 1,
  rewindBonus: 40,
};
