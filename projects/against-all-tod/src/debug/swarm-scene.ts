import type { Army, PlacedDude } from "../battle/army";
import { BATTLE_RULES, type BattleRules } from "../catalog/battle-rules";
import { DUDE_KINDS, paintRadius } from "../catalog/dudes";
import type { PieceId } from "../catalog/pieces";
import { BOARD_ROWS, SPAWN_ZONE_COLUMNS, type Tile } from "../maze/board";
import { emptyMaze, placePiece, type Maze } from "../maze/maze";

/**
 * The swarm debug scene (`?debug=1&scene=swarm`): 500 Interns against a sample Maze, for
 * measuring frame rate. Pure data, so the benchmark runs the same battle headless.
 */
export const SWARM_DUDES = 500;

/** The swarm scene no longer fits the rules: a Piece refused, or too few Interns fit the zone. */
export class SwarmSceneError extends Error {
  override name = "SwarmSceneError";
}

/**
 * 500 Interns packed as tightly as painting allows, row by row from the top of the Spawn zone,
 * each row half a spacing sideways from the last: an Army a player could really paint. One
 * Stroke per row.
 */
export const SWARM_ARMY: Army = packedInterns(SWARM_DUDES);

function packedInterns(count: number): PlacedDude[] {
  // A hair over the painting rule, so rounding never stands two Interns too close.
  const spacing = 2 * paintRadius("intern") * 1.001;
  const rowGap = (spacing * Math.sqrt(3)) / 2;
  const army: PlacedDude[] = [];
  for (let row = 0; army.length < count; row++) {
    const y = row * rowGap;
    if (y >= BOARD_ROWS) {
      throw new SwarmSceneError(
        `Only ${String(army.length)} Interns fit the Spawn zone, not ${String(count)}.`,
      );
    }
    const offset = row % 2 === 0 ? 0 : spacing / 2;
    for (
      let x = offset;
      x < SPAWN_ZONE_COLUMNS && army.length < count;
      x += spacing
    ) {
      army.push({ dudeKind: "intern", at: { x, y }, stroke: row, round: 1 });
    }
  }
  return army;
}

/** A Goal that outlasts every Intern, so only the towers or the clock end the swarm. */
export const SWARM_RULES: BattleRules = {
  ...BATTLE_RULES,
  goalHealth: SWARM_DUDES * DUDE_KINDS.intern.goalDamage + 1,
};

/** Two walls with gaps, so the route winds past rows of Sniper Nests. */
const SWARM_PIECES: readonly { pieceId: PieceId; tile: Tile }[] = [
  ...wallWithGap(8, 12),
  ...wallWithGap(14, 1),
  ...[2, 5, 8, 11].flatMap((row) =>
    [6, 11, 17].map((column) => ({
      pieceId: "sniper-nest" as const,
      tile: { column, row },
    })),
  ),
];

export function swarmMaze(): Maze {
  return SWARM_PIECES.reduce((maze, { pieceId, tile }) => {
    const result = placePiece(maze, tile, pieceId);
    if (!result.ok) {
      throw new SwarmSceneError(
        `The swarm scene's ${pieceId} at (${String(tile.column)}, ${String(tile.row)}) was refused: ${result.refusal}.`,
      );
    }
    return result.maze;
  }, emptyMaze());
}

/** True when the page URL asks for the swarm scene; it needs `debug=1` so players never land in it. */
export function wantsSwarmScene(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get("debug") === "1" && params.get("scene") === "swarm";
}

function wallWithGap(column: number, gapRow: number) {
  return Array.from({ length: BOARD_ROWS }, (_, row) => row)
    .filter((row) => row !== gapRow)
    .map((row) => ({ pieceId: "crate-wall" as const, tile: { column, row } }));
}
