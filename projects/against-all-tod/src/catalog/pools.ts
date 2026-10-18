import type { Side } from "../battle/battle";
import { DUDE_KINDS, type DudeKindId } from "./dudes";
import { MUTATIONS, type MutationId } from "./mutations";
import type { PieceId } from "./pieces";

/**
 * What Draft Crates hold and cost. Pure data: the pools are what is Unlocked (everything, until
 * Unlocks arrive), and balancing a crate means changing a number here.
 */

/** One thing a Draft Crate can offer. */
export type CrateItem =
  | { readonly kind: "piece"; readonly id: PieceId }
  | { readonly kind: "squad"; readonly id: DudeKindId }
  | { readonly kind: "mutation"; readonly id: MutationId };

export interface CrateRules {
  /** Items in one crate. */
  readonly size: number;
  /** In the gold of the side being played. */
  readonly rerollPrice: Readonly<Record<Side, number>>;
}

export const CRATE_RULES: CrateRules = {
  size: 3,
  rerollPrice: { defense: 15, attack: 15 },
};

/** Defense crates hold Pieces; attack crates hold Squads and Mutations. */
export const CRATE_POOLS: Readonly<Record<Side, readonly CrateItem[]>> = {
  defense: [
    { kind: "piece", id: "crate-wall" },
    { kind: "piece", id: "sniper-nest" },
    { kind: "piece", id: "turnstile" },
    { kind: "piece", id: "lighthouse" },
    { kind: "piece", id: "siren" },
  ],
  attack: [
    ...Object.values(DUDE_KINDS).map(({ id }): CrateItem => ({
      kind: "squad",
      id,
    })),
    ...Object.values(MUTATIONS).map(({ id }): CrateItem => ({
      kind: "mutation",
      id,
    })),
  ],
};
