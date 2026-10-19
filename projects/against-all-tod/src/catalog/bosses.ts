import type { Side } from "../battle/battle";
import type { BoardPoint } from "../battle/events";
import type { DudeKindId } from "./dudes";
import type { PieceId } from "./pieces";

/**
 * Every boss and the Boss Round's tuning numbers. Pure data: the battle's bosses module reads the
 * numbers from here. The Landlord's body is a Dude kind and the HR Department's a Piece, so the
 * battle moves, shoots and draws them like any other; their entries live in those catalogs.
 */
export type BossId = "landlord" | "hr-department";

export interface BossEntry {
  readonly id: BossId;
  readonly name: string;
  /** The side the player plays when this boss fights against them. */
  readonly against: Side;
  /** One line for the HUD. */
  readonly description: string;
}

export const BOSSES: Readonly<Record<BossId, BossEntry>> = {
  landlord: {
    id: "landlord",
    name: "The Landlord",
    against: "defense",
    description:
      "Joins the Army with huge health and evicts a Piece every 10 tiles he walks.",
  },
  "hr-department": {
    id: "hr-department",
    name: "The HR Department",
    against: "attack",
    description:
      "Stands in the Maze and sends Wall-breakers in range back to the Spawn zone.",
  },
};

/** The Dude kind The Landlord walks as. */
export const LANDLORD_KIND: DudeKindId = "landlord";
/** The Piece The HR Department stands in the Maze as. */
export const HR_PIECE: PieceId = "hr-department";

/** The Draft Crate that follows a won Boss Round. */
export interface BossCrateRules {
  /** Items in it. */
  readonly size: number;
  /** Items the player takes from it for free. */
  readonly picks: number;
  /** The chance, 0 to 1, that one of its items is a free Undo. */
  readonly freeUndoChance: number;
}

export interface BossRules {
  /** Every this-many-th Round is a Boss Round: 5, 10, 15… */
  readonly bossRoundEvery: number;
  /** Where The Landlord stands in the Spawn zone as the battle starts, in tiles. */
  readonly landlordStart: BoardPoint;
  /** The Landlord evicts a Piece each time he has walked this many more tiles. */
  readonly landlordEvictEveryTiles: number;
  /** In tiles, from the centre of the HR Department's tile. */
  readonly hrRange: number;
  /** The HR Department sends one Wall-breaker back this often. */
  readonly hrIntervalSeconds: number;
  readonly bossCrate: BossCrateRules;
}

export const BOSS_RULES: BossRules = {
  bossRoundEvery: 5,
  // The middle row stays open at every Window size.
  landlordStart: { x: 1.5, y: 7 },
  landlordEvictEveryTiles: 10,
  hrRange: 3,
  hrIntervalSeconds: 2,
  bossCrate: { size: 5, picks: 2, freeUndoChance: 0.3 },
};
