/**
 * Every Piece the defender can place, with its tuning numbers. Pure data: balancing a Piece
 * means changing a number here, and tests read the numbers from here rather than copying them.
 */
export type PieceId = "crate-wall";

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
}

export const PIECES: Readonly<Record<PieceId, PieceEntry>> = {
  "crate-wall": {
    id: "crate-wall",
    name: "Crate Wall",
    description: "A cheap wall. Dudes walk around it.",
    blocksDudes: true,
    price: 10,
    health: 100,
  },
};
