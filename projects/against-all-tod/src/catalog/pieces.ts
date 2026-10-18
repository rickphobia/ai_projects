/**
 * Every Piece the defender can place, with its tuning numbers. Pure data: balancing a Piece
 * means changing a number here, and tests read the numbers from here rather than copying them.
 */
export type PieceId = "crate-wall" | "sniper-nest";

export interface PieceEntry {
  /** Stable id that saves and tests refer to. */
  readonly id: PieceId;
  readonly name: string;
  /** One line for the piece info panel. */
  readonly description: string;
  /** Blocking Pieces shape the route; floor Pieces (later tickets) are walked over. */
  readonly blocksDudes: boolean;
  /** In Defense gold. */
  readonly price: number;
  /** Only Wall-breakers and The Landlord reduce it. */
  readonly health: number;
  /** How it shoots; null for Pieces that don't. */
  readonly tower: TowerStats | null;
}

export interface TowerStats {
  /** In tiles, from the centre of the Piece's tile. */
  readonly range: number;
  /** Health taken from the Dude it hits. */
  readonly damage: number;
  readonly fireIntervalSeconds: number;
}

export const PIECES: Readonly<Record<PieceId, PieceEntry>> = {
  "crate-wall": {
    id: "crate-wall",
    name: "Crate Wall",
    description: "A cheap wall. Dudes walk around it.",
    blocksDudes: true,
    price: 10,
    health: 100,
    tower: null,
  },
  "sniper-nest": {
    id: "sniper-nest",
    name: "Sniper Nest",
    description: "Huge range. Always shoots the biggest Dude in range.",
    blocksDudes: true,
    price: 40,
    health: 150,
    tower: { range: 7, damage: 40, fireIntervalSeconds: 0.8 },
  },
};
