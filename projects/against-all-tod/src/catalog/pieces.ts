/**
 * Every Piece the defender can place, with its tuning numbers. Pure data: balancing a Piece
 * means changing a number here, and tests read the numbers from here rather than copying them.
 */
export type PieceId =
  "crate-wall" | "sniper-nest" | "turnstile" | "lighthouse" | "siren";

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
  /** A sweeping beam that hurts every Dude it touches; null for Pieces without one. */
  readonly beam: BeamStats | null;
  /** A pulse that stuns every Dude in range; null for Pieces without one. */
  readonly stun: StunStats | null;
  /** Seconds between quarter turns, for Pieces that turn (and so block different tiles); null otherwise. */
  readonly turnIntervalSeconds: number | null;
  /** Whether it can hit Balloonists, who fly over everything else. */
  readonly hitsBalloonists: boolean;
}

export interface TowerStats {
  /** In tiles, from the centre of the Piece's tile. */
  readonly range: number;
  /** Health taken from the Dude it hits. */
  readonly damage: number;
  readonly fireIntervalSeconds: number;
}

export interface BeamStats {
  /** In tiles, from the centre of the Piece's tile. */
  readonly range: number;
  /** Half the beam's width, in degrees either side of where it points. */
  readonly halfWidthDegrees: number;
  readonly sweepDegreesPerSecond: number;
  /** Health per second taken from each Dude in the beam. */
  readonly damagePerSecond: number;
  /** Tiles within this many tiles of the Piece count as lit for other towers, even in the dark. */
  readonly lightRadius: number;
}

export interface StunStats {
  /** In tiles at neutral Volume. */
  readonly range: number;
  /** Share of `range` added (Volume up) or taken (Volume down) per Volume step. */
  readonly rangePerVolumeStep: number;
  readonly intervalSeconds: number;
  readonly stunSeconds: number;
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
    beam: null,
    stun: null,
    turnIntervalSeconds: null,
    hitsBalloonists: false,
  },
  "sniper-nest": {
    id: "sniper-nest",
    name: "Sniper Nest",
    description: "Huge range. Always shoots the biggest Dude in range.",
    blocksDudes: true,
    price: 40,
    health: 150,
    tower: { range: 7, damage: 40, fireIntervalSeconds: 0.8 },
    beam: null,
    stun: null,
    turnIntervalSeconds: null,
    hitsBalloonists: true,
  },
  turnstile: {
    id: "turnstile",
    name: "Turnstile",
    description:
      "A wall with two arms that turns 90° every 5 seconds, flipping the route.",
    blocksDudes: true,
    price: 30,
    health: 200,
    tower: null,
    beam: null,
    stun: null,
    turnIntervalSeconds: 5,
    hitsBalloonists: false,
  },
  lighthouse: {
    id: "lighthouse",
    name: "Lighthouse",
    description:
      "Its sweeping beam hurts Dudes, works in the dark and lights nearby tiles.",
    blocksDudes: true,
    price: 50,
    health: 150,
    tower: null,
    beam: {
      range: 3.5,
      halfWidthDegrees: 20,
      sweepDegreesPerSecond: 120,
      damagePerSecond: 90,
      lightRadius: 2,
    },
    stun: null,
    turnIntervalSeconds: null,
    hitsBalloonists: true,
  },
  siren: {
    id: "siren",
    name: "Siren",
    description:
      "Stuns Dudes in range every few seconds. Reaches further with Volume up.",
    blocksDudes: true,
    price: 35,
    health: 120,
    tower: null,
    beam: null,
    stun: {
      range: 2.5,
      rangePerVolumeStep: 0.25,
      intervalSeconds: 4,
      stunSeconds: 1.5,
    },
    turnIntervalSeconds: null,
    hitsBalloonists: false,
  },
};
