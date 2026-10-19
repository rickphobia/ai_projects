import type { Side } from "../battle/battle";
import type { MutationId } from "../catalog/mutations";
import { CRATE_POOLS, CRATE_RULES, type CrateItem } from "../catalog/pools";
import { createRng, type Rng } from "../rng/rng";

/** A Draft Crate as offered: its items, and how often it was rerolled this Round. */
export interface Crate {
  readonly items: readonly CrateItem[];
  readonly rerolls: number;
}

/**
 * The crate for a Round, rolled from the Round's seed and the reroll count, so a Rewound Round
 * (rerolls back at zero) offers the same crate again. Mutations the Army has are left out.
 */
export function crateFor(
  roundSeed: number,
  side: Side,
  mutations: readonly MutationId[],
  rerolls: number,
): Crate {
  const pool = CRATE_POOLS[side].filter(
    (item) => item.kind !== "mutation" || !mutations.includes(item.id),
  );
  const seed = (roundSeed + Math.imul(rerolls + 1, 0x85ebca6b)) >>> 0;
  return { items: draw(pool, CRATE_RULES.size, createRng(seed)), rerolls };
}

/** `count` items, all different while the pool lasts; a pool smaller than that repeats. */
function draw(
  pool: readonly CrateItem[],
  count: number,
  rng: Rng,
): CrateItem[] {
  const drawn: CrateItem[] = [];
  let left: CrateItem[] = [];
  while (drawn.length < count && pool.length > 0) {
    if (left.length === 0) left = [...pool];
    const [item] = left.splice(Math.floor(rng() * left.length), 1);
    if (item !== undefined) drawn.push(item);
  }
  return drawn;
}
