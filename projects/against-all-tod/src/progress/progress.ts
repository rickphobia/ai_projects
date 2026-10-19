import { DUDE_KINDS, isBoss, type DudeKindId } from "../catalog/dudes";
import { PIECES, type PieceId } from "../catalog/pieces";
import type { CrateItem } from "../catalog/pools";

/**
 * Progress across Runs: the best Score, and the Unlocks it has earned. Unlocks are worked out from
 * the best Score and the catalog's milestones rather than stored, so saving the best Score saves
 * them too and a retuned milestone applies to old saves.
 */

/** A Piece or Dude kind that a best Score milestone Unlocks. */
export type Unlock =
  | {
      readonly kind: "piece";
      readonly id: PieceId;
      readonly name: string;
      readonly score: number;
    }
  | {
      readonly kind: "dude";
      readonly id: DudeKindId;
      readonly name: string;
      readonly score: number;
    };

/** Every Unlock, lowest milestone first. */
export const UNLOCKS: readonly Unlock[] = [
  ...Object.values(PIECES).flatMap(({ id, name, unlockScore }): Unlock[] =>
    unlockScore === null
      ? []
      : [{ kind: "piece", id, name, score: unlockScore }],
  ),
  ...Object.values(DUDE_KINDS).flatMap(({ id, name, unlockScore }): Unlock[] =>
    unlockScore === null
      ? []
      : [{ kind: "dude", id, name, score: unlockScore }],
  ),
].sort((a, b) => a.score - b.score);

/** The Unlocks a best Score has earned. */
export function unlocksAt(bestScore: number): Unlock[] {
  return UNLOCKS.filter((unlock) => unlock.score <= bestScore);
}

/** The Unlocks that going from best Score `before` to `after` earned, lowest first. */
export function newUnlocks(before: number, after: number): Unlock[] {
  return UNLOCKS.filter(
    (unlock) => unlock.score > before && unlock.score <= after,
  );
}

/** The next Unlock still to earn, with its milestone; null once all are earned. */
export function nextUnlock(bestScore: number): Unlock | null {
  return UNLOCKS.find((unlock) => unlock.score > bestScore) ?? null;
}

export function isPieceUnlocked(id: PieceId, bestScore: number): boolean {
  const score = PIECES[id].unlockScore;
  return score === null || score <= bestScore;
}

export function isDudeKindUnlocked(id: DudeKindId, bestScore: number): boolean {
  const score = DUDE_KINDS[id].unlockScore;
  return score === null || score <= bestScore;
}

/** Whether a crate may offer `item` at this best Score. */
export function isCrateItemUnlocked(
  item: CrateItem,
  bestScore: number,
): boolean {
  switch (item.kind) {
    case "piece":
      return isPieceUnlocked(item.id, bestScore);
    case "gift":
      return isDudeKindUnlocked(item.id, bestScore);
    case "mutation":
    case "free-undo":
      return true;
  }
}

/** The Dude kinds the shop sells at this best Score: every Unlocked Army kind. */
export function dudeKindsOnSale(bestScore: number): DudeKindId[] {
  return Object.values(DUDE_KINDS).flatMap(({ id }) =>
    !isBoss(id) && isDudeKindUnlocked(id, bestScore) ? [id] : [],
  );
}
