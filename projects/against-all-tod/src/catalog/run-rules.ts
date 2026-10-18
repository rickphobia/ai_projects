/** Tuning numbers for a Run as a whole: Lives and how much each side may place in a Round. */
export interface RunRules {
  readonly startingLives: number;
  /**
   * Pieces the player may place in one Defense turn, and Squads in one Attack turn. A stand-in
   * budget until gold and the shop arrive (ticket 07): without one, an Attack turn is won by
   * filling the Spawn line.
   */
  readonly piecesPerDefenseTurn: number;
  readonly squadsPerAttackTurn: number;
}

export const RUN_RULES: RunRules = {
  startingLives: 3,
  piecesPerDefenseTurn: 3,
  squadsPerAttackTurn: 2,
};
