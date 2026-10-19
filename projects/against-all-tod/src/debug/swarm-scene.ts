import type { Army } from "../battle/army";
import { BATTLE_RULES, type BattleRules } from "../catalog/battle-rules";
import { DUDE_KINDS } from "../catalog/dudes";
import type { PieceId } from "../catalog/pieces";
import { BOARD_ROWS, SPAWN_ZONE_COLUMNS, type Tile } from "../maze/board";
import { emptyMaze, placePiece, type Maze } from "../maze/maze";

/**
 * The swarm debug scene (`?debug=1&scene=swarm`): 500 Interns against a sample Maze, for
 * measuring frame rate. Pure data, so the benchmark runs the same battle headless.
 */
export const SWARM_DUDES = 500;

const SQUADS = SWARM_DUDES / DUDE_KINDS.intern.squadSize;

/** Squads spread down every row of the Spawn zone, front column first, so the Dudes fill the Board. */
export const SWARM_ARMY: Army = Array.from({ length: SQUADS }, (_, index) => ({
  dudeKind: "intern",
  tile: {
    column: SPAWN_ZONE_COLUMNS - 1 - Math.floor(index / BOARD_ROWS),
    row: index % BOARD_ROWS,
  },
}));

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

/** A Piece in the sample Maze was refused: the scene no longer fits the placement rules. */
export class SwarmSceneError extends Error {
  override name = "SwarmSceneError";
}

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
