import type { Side } from "../battle/battle";
import { ARMY_DUDE_KINDS, type DudeKindId } from "./dudes";
import { MUTATIONS, type MutationId } from "./mutations";
import type { PieceId } from "./pieces";

/**
 * What Draft Crates hold and cost. Pure data: the pools are what is Unlocked (everything, until
 * Unlocks arrive), and balancing a crate means changing a number here.
 */

/** One thing a Draft Crate can offer. */
export type CrateItem =
  | { readonly kind: "piece"; readonly id: PieceId }
  /** A gift of free Dudes of one kind, as many as its `giftSize`. */
  | { readonly kind: "gift"; readonly id: DudeKindId }
  | { readonly kind: "mutation"; readonly id: MutationId }
  /** Only in a boss crate: one Undo that skips the payment. */
  | { readonly kind: "free-undo" };

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

/** Defense crates hold Pieces; attack crates hold Dude gifts and Mutations. */
export const CRATE_POOLS: Readonly<Record<Side, readonly CrateItem[]>> = {
  defense: [
    { kind: "piece", id: "crate-wall" },
    { kind: "piece", id: "sniper-nest" },
    { kind: "piece", id: "turnstile" },
    { kind: "piece", id: "lighthouse" },
    { kind: "piece", id: "siren" },
    { kind: "piece", id: "tax-booth" },
    { kind: "piece", id: "grinder" },
    { kind: "piece", id: "bouncer" },
    { kind: "piece", id: "decoy-goal" },
  ],
  attack: [
    ...ARMY_DUDE_KINDS.map((id): CrateItem => ({
      kind: "gift",
      id,
    })),
    ...Object.values(MUTATIONS).map(({ id }): CrateItem => ({
      kind: "mutation",
      id,
    })),
  ],
};
