/** Tuning numbers for the battle as a whole, rather than for one Piece or Dude kind. */
export interface BattleRules {
  readonly goalHealth: number;
  /** A battle still running after this much game time is a defense win. */
  readonly timeLimitSeconds: number;
}

export const BATTLE_RULES: BattleRules = {
  goalHealth: 125,
  timeLimitSeconds: 90,
};
