import type { Side } from "../battle/battle";
import type { BattleEvent } from "../battle/events";
import { DUDE_KINDS, type DudeKindId } from "../catalog/dudes";
import {
  MUTATION_RULES,
  type MutationId,
  type MutationRules,
} from "../catalog/mutations";
import { PIECES, type PieceId } from "../catalog/pieces";
import { GOLD_RULES, type GoldRules } from "../catalog/gold-rules";

/** Gold for each side. The two never mix: each side spends only its own. */
export interface Wallets {
  readonly defense: number;
  readonly attack: number;
}

/** How a battle ended, and what the Army carried into it, as far as gold cares. */
export interface BattleEnd {
  readonly winner: Side;
  readonly goalHealth: number;
  /** Every Dude still alive at the end, walking or waiting on the Spawn line (not ghosts). */
  readonly survivors: readonly DudeKindId[];
  /** The Army's Mutations; Gold Teeth multiplies the gold for reaching the Goal. */
  readonly mutations: readonly MutationId[];
}

export function startingWallets(rules: GoldRules = GOLD_RULES): Wallets {
  return {
    defense: rules.startingDefenseGold,
    attack: rules.startingAttackGold,
  };
}

/** Where a battle's gold came from, source by source, for the Round report. */
export interface GoldBreakdown {
  readonly defense: {
    readonly kills: number;
    readonly goalHealthLeft: number;
    readonly taxed: number;
  };
  readonly attack: {
    readonly reachedGoal: number;
    readonly survivors: number;
    readonly piecesDestroyed: number;
    /** Paid to the defense through Tax Booths; taken off the Attack gold. */
    readonly taxPaid: number;
  };
}

/** The gold a battle earns each side by source, from everything it emitted and how it ended. */
export function goldBreakdown(
  events: readonly BattleEvent[],
  end: BattleEnd,
  rules: GoldRules = GOLD_RULES,
  mutationRules: MutationRules = MUTATION_RULES,
): GoldBreakdown {
  let kills = 0;
  let reachedGoal = 0;
  let piecesDestroyed = 0;
  let taxed = 0;
  const reachGoalMultiplier = end.mutations.includes("gold-teeth")
    ? mutationRules.goldTeethMultiplier
    : 1;
  for (const event of events) {
    if (event.type === "kill") {
      kills += killGold(event.pieceId, event.dudeKind, rules);
    } else if (event.type === "reach-goal") {
      reachedGoal +=
        rules.perReachGoal *
        DUDE_KINDS[event.dudeKind].goldValue *
        reachGoalMultiplier;
    } else if (event.type === "piece-destroyed") {
      piecesDestroyed += rules.perPieceDestroyed;
    } else if (event.type === "taxed") {
      taxed += rules.perTaxedDude;
    }
  }
  let goalHealthLeft = 0;
  let survivors = 0;
  if (end.winner === "defense") {
    goalHealthLeft = Math.floor(
      Math.max(0, end.goalHealth) * rules.perGoalHealthLeft,
    );
  } else {
    for (const kind of end.survivors) {
      survivors += rules.perSurvivor * DUDE_KINDS[kind].goldValue;
    }
  }
  return {
    defense: { kills, goalHealthLeft, taxed },
    attack: { reachedGoal, survivors, piecesDestroyed, taxPaid: taxed },
  };
}

function killGold(
  pieceId: PieceId,
  dudeKind: DudeKindId,
  rules: GoldRules,
): number {
  const trap = PIECES[pieceId].trap;
  const multiplier = trap?.kind === "grinder" ? trap.killGoldMultiplier : 1;
  return rules.perKill * DUDE_KINDS[dudeKind].goldValue * multiplier;
}

/**
 * The gold a battle earns each side, from everything it emitted and how it ended. Attack gold
 * is negative when Tax Booths took more than the attacker earned; `addGold` takes it from the wallet.
 */
export function goldEarned(
  events: readonly BattleEvent[],
  end: BattleEnd,
  rules: GoldRules = GOLD_RULES,
): Wallets {
  const { defense, attack } = goldBreakdown(events, end, rules);
  return {
    defense: defense.kills + defense.goalHealthLeft + defense.taxed,
    attack:
      attack.reachedGoal +
      attack.survivors +
      attack.piecesDestroyed -
      attack.taxPaid,
  };
}

/** A wallet never goes below zero: a Tax Booth can't take gold the attacker doesn't have. */
export function addGold(wallets: Wallets, gold: Wallets): Wallets {
  return {
    defense: Math.max(0, wallets.defense + gold.defense),
    attack: Math.max(0, wallets.attack + gold.attack),
  };
}

/** Takes `price` from one side's wallet only; null when that side can't afford it. */
export function spend(
  wallets: Wallets,
  side: Side,
  price: number,
): Wallets | null {
  if (wallets[side] < price) return null;
  return { ...wallets, [side]: wallets[side] - price };
}
