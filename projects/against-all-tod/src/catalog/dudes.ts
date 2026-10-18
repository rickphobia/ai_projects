/**
 * Every Dude kind, with its tuning numbers. Pure data: balancing a Dude kind means changing a
 * number here, and tests read the numbers from here rather than copying them.
 */
export type DudeKindId = "intern";

export interface DudeKindEntry {
  /** Stable id that saves and tests refer to. */
  readonly id: DudeKindId;
  readonly name: string;
  /** One line for the info panel. */
  readonly description: string;
  readonly health: number;
  /** Tiles per second. */
  readonly speed: number;
  /** Goal health a Dude of this kind takes when it reaches the Goal. */
  readonly goalDamage: number;
  /** How big it is; the Sniper Nest shoots the biggest Dude in range. */
  readonly size: number;
  readonly squadSize: number;
  /** Time between one Dude of a Squad entering and the next, so a Squad files in. */
  readonly spawnIntervalSeconds: number;
}

export const DUDE_KINDS: Readonly<Record<DudeKindId, DudeKindEntry>> = {
  intern: {
    id: "intern",
    name: "Intern",
    description: "Cheap fodder that comes 20 to a Squad.",
    health: 30,
    speed: 1.6,
    goalDamage: 5,
    size: 1,
    squadSize: 20,
    spawnIntervalSeconds: 0.25,
  },
};

/** The small game-made Army of Round 1, before the player has attacked: one Squad per Spawn line row. */
export const ROUND_ONE_ARMY: readonly {
  readonly dudeKind: DudeKindId;
  readonly spawnRow: number;
}[] = [
  { dudeKind: "intern", spawnRow: 3 },
  { dudeKind: "intern", spawnRow: 10 },
];
