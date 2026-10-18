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
export type BattleEvent =
  | ShotEvent
  | KillEvent
  | ReachGoalEvent
  | PieceDestroyedEvent
  | TaxedEvent
  | DecoyHitEvent;

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

/** A Wall-breaker destroyed a Piece: it is gone, and the routes now go through its tile. */
export interface PieceDestroyedEvent {
  readonly type: "piece-destroyed";
  readonly step: number;
  readonly pieceId: PieceId;
  readonly pieceTile: Tile;
  /** The Wall-breaker whose hit destroyed it. */
  readonly dudeId: number;
  readonly dudeKind: DudeKindId;
}

/** A Dude stepped onto a Tax Booth; the economy moves the gold. */
export interface TaxedEvent {
  readonly type: "taxed";
  readonly step: number;
  readonly pieceTile: Tile;
  readonly dudeId: number;
  readonly dudeKind: DudeKindId;
}

/** A Dude reached a Decoy Goal and vanished, earning nothing. */
export interface DecoyHitEvent {
  readonly type: "decoy-hit";
  readonly step: number;
  readonly pieceTile: Tile;
  readonly dudeId: number;
  readonly dudeKind: DudeKindId;
  /** Decoy health it took. */
  readonly damage: number;
}
