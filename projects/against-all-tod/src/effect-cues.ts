import type { BattleEvent, BoardPoint } from "./battle/events";
import { HR_PIECE } from "./catalog/bosses";
import { isBoss } from "./catalog/dudes";
import type { MutationId } from "./catalog/mutations";
import { goldEarned } from "./economy/economy";
import { BOARD_COLUMNS, BOARD_ROWS, goalTiles, type Tile } from "./maze/board";
import type { RunState } from "./run/run";

/**
 * Which effects the Run screen asks the renderer for, worked out from the battle's events and
 * the Run: where gold pops up, and which moments shake the screen. Rules stay with the battle
 * and the economy; this only reads what they say.
 */

/** "+Xg" at a spot on the Board. */
export interface GoldPop {
  readonly at: BoardPoint;
  readonly amount: number;
}

/**
 * The gold each event earns, popped where it was earned: kills where the Dude fell, Dudes
 * reaching the Goal at the Goal, Pieces destroyed and Tax Booth takings at the Piece. Only gold
 * gained is shown; the attacker's tax is not. Gold for how the battle ends comes in the report.
 */
export function goldPopsOf(
  events: readonly BattleEvent[],
  mutations: readonly MutationId[],
): GoldPop[] {
  return events.flatMap((event) => {
    const at = spotOf(event);
    if (at === null) return [];
    // No end bonuses: an attack win with no survivors and no Goal left adds nothing to one event's gold.
    const earned = goldEarned([event], {
      winner: "attack",
      goalHealth: 0,
      survivors: [],
      mutations,
    });
    return [earned.defense, earned.attack]
      .filter((amount) => amount > 0)
      .map((amount) => ({ at, amount }));
  });
}

/** A boss dying: The Landlord killed, or The HR Department destroyed. */
export function bossFell(events: readonly BattleEvent[]): boolean {
  return events.some(
    (event) =>
      (event.type === "kill" && isBoss(event.dudeKind)) ||
      (event.type === "piece-destroyed" && event.pieceId === HR_PIECE),
  );
}

/**
 * Where Take back's refund pops up: on the Piece it took off the Board, or among the Dudes it
 * took out of the Spawn zone; the Board's middle for anything else (a crate pick, a slider).
 */
export function refundSpot(before: RunState, after: RunState): BoardPoint {
  const kept = new Set(after.pieces);
  const piece = before.pieces.find((placed) => !kept.has(placed));
  if (piece !== undefined) return centreOf(piece.tile);
  const stayed = new Set(after.army);
  const gone = before.army.filter((dude) => !stayed.has(dude));
  if (gone.length > 0) {
    return {
      x: gone.reduce((sum, dude) => sum + dude.at.x, 0) / gone.length,
      y: gone.reduce((sum, dude) => sum + dude.at.y, 0) / gone.length,
    };
  }
  return { x: BOARD_COLUMNS / 2, y: BOARD_ROWS / 2 };
}

function spotOf(event: BattleEvent): BoardPoint | null {
  switch (event.type) {
    case "kill":
      return event.at;
    case "reach-goal":
      return goalCentre();
    case "piece-destroyed":
    case "taxed":
      return centreOf(event.pieceTile);
    default:
      return null;
  }
}

function goalCentre(): BoardPoint {
  const goal = goalTiles();
  const rows = goal.map((tile) => tile.row);
  return {
    x: Math.min(...goal.map((tile) => tile.column)) + 0.5,
    y: (Math.min(...rows) + Math.max(...rows) + 1) / 2,
  };
}

function centreOf(tile: Tile): BoardPoint {
  return { x: tile.column + 0.5, y: tile.row + 0.5 };
}
