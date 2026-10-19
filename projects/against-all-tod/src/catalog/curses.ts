import type { Side } from "../battle/battle";

/**
 * Every Curse the Run can roll, with its tuning numbers. Pure data: the battle's curses module
 * reads the numbers from here.
 */
export type CurseId =
  | "rust"
  | "power-cut"
  | "earthquake"
  | "audit"
  | "traffic-jam"
  | "mud"
  | "stage-fright"
  | "union-break";

export interface CurseEntry {
  /** Stable id that saves and tests refer to. */
  readonly id: CurseId;
  readonly name: string;
  /** The side it hurts. */
  readonly hurts: Side;
  /** One line for the HUD. */
  readonly description: string;
}

export const CURSES: Readonly<Record<CurseId, CurseEntry>> = {
  rust: {
    id: "rust",
    name: "Rust",
    hurts: "defense",
    description: "Towers fire 20% slower.",
  },
  "power-cut": {
    id: "power-cut",
    name: "Power Cut",
    hurts: "defense",
    description: "Lighthouses and Sirens are off.",
  },
  earthquake: {
    id: "earthquake",
    name: "Earthquake",
    hurts: "defense",
    description: "One random Piece moves one tile for the battle.",
  },
  audit: {
    id: "audit",
    name: "Audit",
    hurts: "defense",
    description: "Tax Booths pay nothing.",
  },
  "traffic-jam": {
    id: "traffic-jam",
    name: "Traffic Jam",
    hurts: "attack",
    description: "The Army sets off one Dude at a time, in paint order.",
  },
  mud: {
    id: "mud",
    name: "Mud",
    hurts: "attack",
    description: "Dudes walk 20% slower.",
  },
  "stage-fright": {
    id: "stage-fright",
    name: "Stage Fright",
    hurts: "attack",
    description: "Hype Men don't work.",
  },
  "union-break": {
    id: "union-break",
    name: "Union Break",
    hurts: "attack",
    description: "Wall-breakers can't damage Pieces.",
  },
};

/** Every Curse, in a fixed order, so a seeded roll picks the same one on every machine. */
export const CURSE_IDS: readonly CurseId[] = Object.keys(CURSES) as CurseId[];

/** Tuning numbers for the Curses' effects. */
export interface CurseRules {
  /** The first Round a Curse is rolled for. */
  readonly firstCursedRound: number;
  /** Rust: the time between a tower's shots is multiplied by this (1.25 fires 20% slower). */
  readonly rustReloadMultiplier: number;
  /** Mud: every Dude's speed is multiplied by this. */
  readonly mudSpeedMultiplier: number;
  /** Traffic Jam: the time between one Dude setting off and the next. */
  readonly trafficJamGapSeconds: number;
}

export const CURSE_RULES: CurseRules = {
  firstCursedRound: 2,
  rustReloadMultiplier: 1.25,
  mudSpeedMultiplier: 0.8,
  trafficJamGapSeconds: 0.1,
};
