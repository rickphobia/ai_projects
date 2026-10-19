# Paint single Dudes into a Spawn zone, not Squads on a Spawn line

The attacker used to buy Squads (20 Interns, 10 Termites…) and drop each on one tile of a one-column Spawn line, from where they filed in one by one. We changed it to work like Totally Accurate Battle Simulator: the left 3 columns are a Spawn zone (the Board grows to 22 × 14 so the Maze keeps 19 columns), the attacker paints single Dudes into it by dragging, paying per Dude, and the whole Army charges at once when the battle starts. Placing where each Dude stands is the fun of the Attack turn, and a Squad on a tile gave no shape to choose. Squads leave the game completely: the Army is every Dude placed so far.

**Trade-offs:** old saves can't be read and start fresh; Giant and Conga Line lose their "per Squad" meaning (Giant now makes every Nth Dude of a kind giant, N being the kind's old Squad size; Conga Line works per Stroke); the zone's space caps the Army at about 500 Interns' worth, so Dismiss exists to make room; painting has to share the drag gesture with camera panning.

**Considered Options:** keeping Squads as the placed unit with a wider Spawn line (no real choice of shape); a Squad as one paint Stroke (one-Dude Strokes would make every Dude a 5× Giant under the Giant Mutation).
