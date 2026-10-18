import type { Side } from "../battle/battle";
import type { BattleEvent } from "../battle/events";
import { DUDE_KINDS, type DudeKindId } from "../catalog/dudes";
import { GOLD_RULES, type GoldRules } from "../catalog/gold-rules";
import type { PieceId } from "../catalog/pieces";

/** Gold for each side. The two never mix: each side spends only its own. */
export interface Wallets {
  readonly defense: number;
  readonly attack: number;
}

/**
 * A Wall-breaker destroying a Piece. The battle doesn't emit it until Wall-breakers arrive
 * (ticket 13), which moves it into the battle's own events.
 */
export interface PieceDestroyedEvent {
  readonly type: "piece-destroyed";
  readonly step: number;
  readonly pieceId: PieceId;
}

export type GoldEvent = BattleEvent | PieceDestroyedEvent;

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

/** The gold a battle earns each side, from everything it emitted and how it ended. */
export function goldEarned(
  events: readonly GoldEvent[],
  end: BattleEnd,
  rules: GoldRules = GOLD_RULES,
): Wallets {
  let defense = 0;
  let attack = 0;
  for (const event of events) {
    if (event.type === "kill") {
      defense += rules.perKill * DUDE_KINDS[event.dudeKind].goldValue;
    } else if (event.type === "reach-goal") {
      attack += rules.perReachGoal * DUDE_KINDS[event.dudeKind].goldValue;
    } else if (event.type === "piece-destroyed") {
      attack += rules.perPieceDestroyed;
    }
  }
  if (end.winner === "defense") {
    defense += Math.floor(
      Math.max(0, end.goalHealth) * rules.perGoalHealthLeft,
    );
  } else {
    for (const kind of end.survivors) {
      attack += rules.perSurvivor * DUDE_KINDS[kind].goldValue;
    }
  }
  return { defense, attack };
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
