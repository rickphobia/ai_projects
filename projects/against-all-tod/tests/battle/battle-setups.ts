import type { Army, Squad } from "../../src/battle/army";
import type { BattleSetup } from "../../src/battle/battle";
import { BATTLE_RULES, type BattleRules } from "../../src/catalog/battle-rules";
import type { DudeKindId } from "../../src/catalog/dudes";
import type { MutationId } from "../../src/catalog/mutations";
import type { PieceId } from "../../src/catalog/pieces";
import { BOARD_ROWS, type Tile } from "../../src/maze/board";
import { emptyMaze, placePiece, type Maze } from "../../src/maze/maze";
import { NEUTRAL_SLIDERS } from "../../src/tricks/tricks";

/** Small hand-built Boards and Armies shared by the battle tests. */

export function mazeWith(
  pieces: readonly { pieceId: PieceId; tile: Tile }[],
): Maze {
  return pieces.reduce((maze, { pieceId, tile }) => {
    const result = placePiece(maze, tile, pieceId);
    if (!result.ok) {
      throw new Error(
        `${pieceId} at (${String(tile.column)}, ${String(tile.row)}) refused: ${result.refusal}`,
      );
    }
    return result.maze;
  }, emptyMaze());
}

/** A Squad of `dudeKind` on the Spawn zone tile in `row`, in the zone's back column unless given. */
export function squadAt(dudeKind: DudeKindId, row: number, column = 0): Squad {
  return { dudeKind, tile: { column, row } };
}

/** A Squad of Interns in the back column of each given row. */
export function internSquads(...rows: number[]): Army {
  return rows.map((row) => squadAt("intern", row));
}

export function setupOf(
  maze: Maze,
  army: Army,
  rules: Partial<BattleRules> = {},
  seed = 1,
  mutations: readonly MutationId[] = [],
): BattleSetup {
  return {
    maze,
    army,
    mutations,
    seed,
    rules: { ...BATTLE_RULES, ...rules },
    sliders: NEUTRAL_SLIDERS,
    sliderInputs: [],
  };
}

/** A wall down `column` with a one-tile gap at `gapRow`. */
export function wallWithGap(column: number, gapRow: number): Tile[] {
  return Array.from({ length: BOARD_ROWS }, (_, row) => ({
    column,
    row,
  })).filter((tile) => tile.row !== gapRow);
}

export function crateWalls(tiles: readonly Tile[]) {
  return tiles.map((tile) => ({ pieceId: "crate-wall" as const, tile }));
}
