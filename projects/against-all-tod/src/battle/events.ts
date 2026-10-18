import type { DudeKindId } from "../catalog/dudes";
import type { PieceId } from "../catalog/pieces";
import type { Tile } from "../maze/board";

/** A point on the Board in tiles: (0, 0) is the top left corner, (0.5, 0.5) the centre of the first tile. */
export interface BoardPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * What happened in a battle step, for the renderer now and for gold and the Round report later.
 * `step` is the step it happened in, counted from 1.
 */
export type BattleEvent = ShotEvent | KillEvent | ReachGoalEvent;

export interface ShotEvent {
  readonly type: "shot";
  readonly step: number;
  readonly pieceId: PieceId;
  readonly pieceTile: Tile;
  readonly dudeId: number;
  /** Where the Dude was when hit. */
  readonly at: BoardPoint;
}

export interface KillEvent {
  readonly type: "kill";
  readonly step: number;
  readonly pieceId: PieceId;
  readonly pieceTile: Tile;
  readonly dudeId: number;
  readonly dudeKind: DudeKindId;
  /** Where the Dude died, for the report's death map. */
  readonly at: BoardPoint;
}

export interface ReachGoalEvent {
  readonly type: "reach-goal";
  readonly step: number;
  readonly dudeId: number;
  readonly dudeKind: DudeKindId;
  /** Goal health it took. */
  readonly damage: number;
}
