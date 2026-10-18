/** Tuning numbers for a Run as a whole. Gold has its own in gold-rules. */
export interface RunRules {
  readonly startingLives: number;
}

export const RUN_RULES: RunRules = {
  startingLives: 3,
};
