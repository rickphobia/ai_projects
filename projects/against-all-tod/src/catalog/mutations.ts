/**
 * Every Mutation an attack Draft Crate can offer. Pure data. Ticket 15 gives them their battle
 * effects; until then a picked Mutation is only stored on the Run.
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
    description: "A Dude splits into two halves when it dies.",
  },
  giant: {
    id: "giant",
    name: "Giant",
    description: "One Dude per Squad is giant: 5× health, half speed.",
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
    description: "A Squad walks in single file and shares damage.",
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
