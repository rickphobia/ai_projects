/**
 * Every Piece the defender can place, with its tuning numbers. Pure data: balancing a Piece
 * means changing a number here, and tests read the numbers from here rather than copying them.
 */
export type PieceId =
  | "crate-wall"
  | "sniper-nest"
  | "turnstile"
  | "lighthouse"
  | "siren"
  | "tax-booth"
  | "grinder"
  | "bouncer"
  | "decoy-goal";

export interface PieceEntry {
  /** Stable id that saves and tests refer to. */
  readonly id: PieceId;
  readonly name: string;
  /** One line for the piece info panel. */
  readonly description: string;
  /** Blocking Pieces shape the route; floor Pieces (Tax Booth, Grinder) are walked over. */
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
  /** What it does to the Dudes that cross or touch it; null for Pieces that only block or shoot. */
  readonly trap: TrapStats | null;
  /** The best Score that Unlocks it; null when it is there from the start. */
  readonly unlockScore: number | null;
}

/** Floor Pieces act on Dudes walking onto their tile; the Bouncer on Dudes beside it; the Decoy Goal draws Dudes in. */
export type TrapStats =
  /** Every walking Dude that steps onto it moves Attack gold into Defense gold (the amount is a gold rule). */
  | { readonly kind: "tax-booth" }
  | {
      readonly kind: "grinder";
      /** Dude kinds it kills outright. */
      readonly smallKinds: readonly DudeKindId[];
      /** Health taken from any other Dude that steps onto it. */
      readonly damage: number;
      /** It does nothing for this long after each kill. */
      readonly jamSeconds: number;
      /** Its kills pay this many times the usual Defense gold. */
      readonly killGoldMultiplier: number;
    }
  | {
      readonly kind: "bouncer";
      /** A walking Dude this close to its tile centre, in tiles, is touching it. */
      readonly touchRange: number;
      readonly cooldownSeconds: number;
    }
  /** Walkers that can reach it go for it before the Goal; each one hits it with its Goal damage and vanishes. */
  | { readonly kind: "decoy-goal" };

import type { DudeKindId } from "./dudes";

export interface TowerStats {
  /** In tiles, from the centre of the Piece's tile. */
  readonly range: number;
  /** Health taken from the Dude it hits. */
  readonly damage: number;
  readonly fireIntervalSeconds: number;
  /** Whether it can shoot flying Dudes such as the Balloonist. */
  readonly hitsAir: boolean;
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
  /** Whether the beam hurts flying Dudes such as the Balloonist. */
  readonly hitsAir: boolean;
}

export interface StunStats {
  /** In tiles at neutral Volume. */
  readonly range: number;
  /** Share of `range` added (Volume up) or taken (Volume down) per Volume step. */
  readonly rangePerVolumeStep: number;
  readonly intervalSeconds: number;
  readonly stunSeconds: number;
  /** Whether the pulse stuns flying Dudes such as the Balloonist. */
  readonly hitsAir: boolean;
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
    trap: null,
    unlockScore: null,
  },
  "sniper-nest": {
    id: "sniper-nest",
    name: "Sniper Nest",
    description: "Huge range. Always shoots the biggest Dude in range.",
    blocksDudes: true,
    price: 40,
    health: 150,
    tower: { range: 7, damage: 40, fireIntervalSeconds: 0.8, hitsAir: true },
    beam: null,
    stun: null,
    turnIntervalSeconds: null,
    trap: null,
    unlockScore: null,
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
    trap: null,
    unlockScore: null,
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
      hitsAir: true,
    },
    stun: null,
    turnIntervalSeconds: null,
    trap: null,
    unlockScore: null,
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
      hitsAir: false,
    },
    turnIntervalSeconds: null,
    trap: null,
    unlockScore: null,
  },
  "tax-booth": {
    id: "tax-booth",
    name: "Tax Booth",
    description:
      "Floor. Every Dude that walks over it pays the defender from the attacker's gold.",
    blocksDudes: false,
    price: 30,
    health: 100,
    tower: null,
    beam: null,
    stun: null,
    turnIntervalSeconds: null,
    trap: { kind: "tax-booth" },
    unlockScore: null,
  },
  grinder: {
    id: "grinder",
    name: "Grinder",
    description:
      "Floor. Kills small Dudes outright for double gold, then jams for 3 seconds.",
    blocksDudes: false,
    price: 45,
    health: 100,
    tower: null,
    beam: null,
    stun: null,
    turnIntervalSeconds: null,
    trap: {
      kind: "grinder",
      smallKinds: ["intern", "termite", "streaker"],
      damage: 60,
      jamSeconds: 3,
      killGoldMultiplier: 2,
    },
    unlockScore: null,
  },
  bouncer: {
    id: "bouncer",
    name: "Bouncer",
    description: "Throws the first Dude it touches back to the Spawn line.",
    blocksDudes: true,
    price: 40,
    health: 150,
    tower: null,
    beam: null,
    stun: null,
    turnIntervalSeconds: null,
    trap: { kind: "bouncer", touchRange: 1.1, cooldownSeconds: 6 },
    unlockScore: 10,
  },
  "decoy-goal": {
    id: "decoy-goal",
    name: "Decoy Goal",
    description:
      "Dudes go for it first until it breaks. Dudes that hit it earn nothing.",
    blocksDudes: true,
    price: 35,
    health: 60,
    tower: null,
    beam: null,
    stun: null,
    turnIntervalSeconds: null,
    trap: { kind: "decoy-goal" },
    unlockScore: 20,
  },
};
