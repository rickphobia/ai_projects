import type { Side } from "../battle/battle";
import type { BattleEvent } from "../battle/events";
import { DUDE_KINDS, type DudeKindId } from "../catalog/dudes";
import { GOLD_RULES, type GoldRules } from "../catalog/gold-rules";

/** Gold for each side. The two never mix: each side spends only its own. */
export interface Wallets {
  readonly defense: number;
  readonly attack: number;
}

/** How a battle ended, as far as gold cares. */
export interface BattleEnd {
  readonly winner: Side;
  readonly goalHealth: number;
  /** Every Dude still alive at the end, walking or waiting on the Spawn line. */
  readonly survivors: readonly DudeKindId[];
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
  };
  readonly attack: {
    readonly reachedGoal: number;
    readonly survivors: number;
    readonly piecesDestroyed: number;
  };
}

/** The gold a battle earns each side by source, from everything it emitted and how it ended. */
export function goldBreakdown(
  events: readonly BattleEvent[],
  end: BattleEnd,
  rules: GoldRules = GOLD_RULES,
): GoldBreakdown {
  let kills = 0;
  let reachedGoal = 0;
  let piecesDestroyed = 0;
  for (const event of events) {
    if (event.type === "kill") {
      kills += rules.perKill * DUDE_KINDS[event.dudeKind].goldValue;
    } else if (event.type === "reach-goal") {
      reachedGoal += rules.perReachGoal * DUDE_KINDS[event.dudeKind].goldValue;
    } else if (event.type === "piece-destroyed") {
      piecesDestroyed += rules.perPieceDestroyed;
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
    defense: { kills, goalHealthLeft },
    attack: { reachedGoal, survivors, piecesDestroyed },
  };
}

/** The gold a battle earns each side, from everything it emitted and how it ended. */
export function goldEarned(
  events: readonly BattleEvent[],
  end: BattleEnd,
  rules: GoldRules = GOLD_RULES,
): Wallets {
  const { defense, attack } = goldBreakdown(events, end, rules);
  return {
    defense: defense.kills + defense.goalHealthLeft,
    attack: attack.reachedGoal + attack.survivors + attack.piecesDestroyed,
  };
}

export function addGold(wallets: Wallets, gold: Wallets): Wallets {
  return {
    defense: wallets.defense + gold.defense,
    attack: wallets.attack + gold.attack,
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
