/** Tuning numbers for the battle as a whole, rather than for one Piece or Dude kind. */
export interface BattleRules {
  readonly goalHealth: number;
  /** A battle still running after this much game time is a defense win. */
  readonly timeLimitSeconds: number;
  /** The Volume trick's level, -2 to 2; it scales the Hype Man's boost. Neutral until the Volume trick arrives. */
  readonly volumeLevel: number;
}

export const BATTLE_RULES: BattleRules = {
  goalHealth: 100,
  timeLimitSeconds: 90,
  volumeLevel: 0,
};
