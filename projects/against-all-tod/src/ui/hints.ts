/** One-line hints for the first Rounds of a player's first Run, in place of a tutorial. */
const FIRST_RUN_HINTS: readonly string[] = [
  "Hint: place walls so the Dudes walk the long way past your towers.",
  "Hint: you switch sides every Round. Now you attack the Maze you just built.",
  "Hint: the Settings menu isn't just settings. Its sliders change the battle.",
];

/** The hint for `round`, or null outside the first Run's first Rounds. */
export function roundHint(round: number, firstRun: boolean): string | null {
  if (!firstRun) return null;
  return FIRST_RUN_HINTS[round - 1] ?? null;
}
