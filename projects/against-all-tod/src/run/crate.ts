import type { Side } from "../battle/battle";
import { BOSS_RULES } from "../catalog/bosses";
import type { MutationId } from "../catalog/mutations";
import { CRATE_POOLS, CRATE_RULES, type CrateItem } from "../catalog/pools";
import { isCrateItemUnlocked } from "../progress/progress";
import { createRng, type Rng } from "../rng/rng";

/**
 * Which crate a Round opens: a Draft Crate, or the boss crate after a won Boss Round. Once its
 * free Undo is taken, a boss crate rerolls without the chance of another, so rerolling can't
 * fish for a second.
 */
export type CrateKind = "draft" | "boss" | "boss-undo-taken";

/** A crate as offered: its kind, its items, the picks left, and how often it was rerolled this Round. */
export interface Crate {
  readonly kind: CrateKind;
  readonly items: readonly CrateItem[];
  /** Items still to take for free: 1 in a Draft Crate, more in a boss crate. */
  readonly picks: number;
  readonly rerolls: number;
}

/**
 * The crate for a Round, rolled from the Round's seed and the reroll count, so a Rewound Round
 * (rerolls back at zero) offers the same crate again. Items `bestScore` hasn't Unlocked and
 * Mutations the Army has are left out. A boss
 * crate is bigger, takes more picks, and by chance holds a free Undo.
 */
export function crateFor(
  roundSeed: number,
  side: Side,
  mutations: readonly MutationId[],
  bestScore: number,
  rerolls: number,
  kind: CrateKind = "draft",
): Crate {
  const pool = CRATE_POOLS[side].filter(
    (item) =>
      isCrateItemUnlocked(item, bestScore) &&
      (item.kind !== "mutation" || !mutations.includes(item.id)),
  );
  const seed = (roundSeed + Math.imul(rerolls + 1, 0x85ebca6b)) >>> 0;
  const rng = createRng(seed);
  if (kind === "draft") {
    const items = draw(pool, CRATE_RULES.size, rng);
    return { kind, items, picks: 1, rerolls };
  }
  const { size, picks, freeUndoChance } = BOSS_RULES.bossCrate;
  // Rolled even when it can't be used, so both boss kinds draw the same items from a seed.
  const undoRoll = rng() < freeUndoChance;
  const withUndo = undoRoll && kind === "boss";
  const items = draw(pool, withUndo ? size - 1 : size, rng);
  if (withUndo) {
    items.splice(Math.floor(rng() * (items.length + 1)), 0, {
      kind: "free-undo",
    });
  }
  return { kind, items, picks, rerolls };
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
