/**
 * Every Mutation an attack Draft Crate can offer, with its tuning numbers. Pure data: the
 * battle's mutations module and the economy read the numbers from here.
 */
export type MutationId =
  | "split"
  | "giant"
  | "explosive-shields"
  | "conga-line"
  | "ghost-mode"
  | "gold-teeth";

export interface MutationEntry {
  /** Stable id that saves and tests refer to. */
  readonly id: MutationId;
  readonly name: string;
  /** One line for the crate. */
  readonly description: string;
}

export const MUTATIONS: Readonly<Record<MutationId, MutationEntry>> = {
  split: {
    id: "split",
    name: "Split",
    description:
      "A Dude splits into two halves when it dies, each hitting the Goal half as hard.",
  },
  giant: {
    id: "giant",
    name: "Giant",
    description:
      "Every Nth Dude of a kind you paint is giant (1 in 20 Interns): 5× health, half speed.",
  },
  "explosive-shields": {
    id: "explosive-shields",
    name: "Explosive Shields",
    description:
      "Every Dude's small shield stuns nearby towers when it breaks.",
  },
  "conga-line": {
    id: "conga-line",
    name: "Conga Line",
    description:
      "Each Stroke you paint walks in single file and shares damage.",
  },
  "ghost-mode": {
    id: "ghost-mode",
    name: "Ghost Mode",
    description: "Dead Dudes keep walking for 3 seconds and can't be shot.",
  },
  "gold-teeth": {
    id: "gold-teeth",
    name: "Gold Teeth",
    description: "Dudes reaching the Goal earn double Attack gold.",
  },
};

/** Tuning numbers for the Mutations' effects. */
export interface MutationRules {
  /** Split: each half gets this share of the dead Dude's full health. */
  readonly splitHealthShare: number;
  /** Split: each half takes this share of its kind's Goal damage, so one Dude can't hit the Goal twice as hard. */
  readonly splitGoalDamageShare: number;
  /** Giant: the giant's health and speed, as multiples of its kind's. */
  readonly giantHealthMultiplier: number;
  readonly giantSpeedMultiplier: number;
  /** Explosive Shields: damage each Dude's small shield soaks before it breaks. */
  readonly smallShieldHealth: number;
  /** Explosive Shields: towers this close (in tiles) to a breaking shield are stunned. */
  readonly shieldBurstRange: number;
  readonly shieldBurstStunSeconds: number;
  /** Ghost Mode: how long a dead Dude keeps walking. */
  readonly ghostSeconds: number;
  /** Gold Teeth: Attack gold for a Dude reaching the Goal is multiplied by this. */
  readonly goldTeethMultiplier: number;
}

export const MUTATION_RULES: MutationRules = {
  splitHealthShare: 0.5,
  splitGoalDamageShare: 0.5,
  giantHealthMultiplier: 5,
  giantSpeedMultiplier: 0.5,
  smallShieldHealth: 10,
  shieldBurstRange: 2,
  shieldBurstStunSeconds: 1,
  ghostSeconds: 3,
  goldTeethMultiplier: 2,
};
