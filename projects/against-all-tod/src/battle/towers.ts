import { DUDE_KINDS } from "../catalog/dudes";
import { PIECES, type PieceId, type TowerStats } from "../catalog/pieces";
import type { Tile } from "../maze/board";
import { placedPieces, type Maze } from "../maze/maze";
import { distanceToGoal, type Route } from "../maze/route";
import { tileUnder, type DudeState } from "./dudes";
import type { BattleEvent, BoardPoint } from "./events";

/** A Piece without tower stats was asked to shoot: a catalog or `towersOf` bug. */
export class TowerStatsError extends Error {
  override name = "TowerStatsError";
}

/** One shooting Piece during a battle. */
export interface TowerState {
  readonly pieceId: PieceId;
  readonly tile: Tile;
  /** Steps left until it may fire again; 0 means ready. */
  readonly cooldownSteps: number;
  /** Where it last fired, so the renderer can turn it; null before its first shot. */
  readonly aimedAt: BoardPoint | null;
}

/** What a Sniper Nest weighs when choosing whom to shoot. */
export interface TargetCandidate {
  readonly id: number;
  readonly size: number;
  /** Route steps left to the Goal. */
  readonly distanceToGoal: number;
}

/** Every shooting Piece in the Maze, top row first, so they always fire in the same order. */
export function towersOf(maze: Maze): TowerState[] {
  return placedPieces(maze)
    .filter(({ pieceId }) => PIECES[pieceId].tower !== null)
    .sort((a, b) => a.tile.row - b.tile.row || a.tile.column - b.tile.column)
    .map(({ pieceId, tile }) => ({
      pieceId,
      tile,
      cooldownSteps: 0,
      aimedAt: null,
    }));
}

/**
 * The Sniper Nest's choice: the biggest Dude, then the one closest to the Goal, then the one
 * that entered first. Null when there is no one to shoot.
 */
export function pickTarget(
  candidates: readonly TargetCandidate[],
): number | null {
  let best: TargetCandidate | null = null;
  for (const candidate of candidates) {
    if (
      best === null ||
      candidate.size > best.size ||
      (candidate.size === best.size &&
        (candidate.distanceToGoal < best.distanceToGoal ||
          (candidate.distanceToGoal === best.distanceToGoal &&
            candidate.id < best.id)))
    ) {
      best = candidate;
    }
  }
  return best?.id ?? null;
}

export interface VolleyResult {
  readonly towers: TowerState[];
  /** The Dudes still alive. */
  readonly dudes: DudeState[];
  readonly events: BattleEvent[];
}

/** Every ready tower shoots once, in order, each seeing the damage the ones before it did. */
export function fireTowers(
  towers: readonly TowerState[],
  dudes: readonly DudeState[],
  route: Route,
  step: number,
  stepsPerSecond: number,
): VolleyResult {
  const alive = new Map(dudes.map((dude) => [dude.id, dude]));
  const events: BattleEvent[] = [];
  const nextTowers = towers.map((tower): TowerState => {
    const stats = statsOf(tower.pieceId);
    if (tower.cooldownSteps > 1) {
      return { ...tower, cooldownSteps: tower.cooldownSteps - 1 };
    }
    const inRange = [...alive.values()].filter((dude) =>
      isInRange(tower.tile, stats.range, dude),
    );
    const targetId = pickTarget(
      inRange.map((dude) => ({
        id: dude.id,
        size: DUDE_KINDS[dude.kind].size,
        distanceToGoal: distanceToGoal(route, tileUnder(dude)) ?? Infinity,
      })),
    );
    const target = targetId === null ? undefined : alive.get(targetId);
    if (target === undefined) return { ...tower, cooldownSteps: 0 };

    const at = { x: target.x, y: target.y };
    const shotAt = { step, pieceId: tower.pieceId, pieceTile: tower.tile, at };
    events.push({ type: "shot", dudeId: target.id, ...shotAt });
    const health = target.health - stats.damage;
    if (health <= 0) {
      alive.delete(target.id);
      events.push({
        type: "kill",
        dudeId: target.id,
        dudeKind: target.kind,
        ...shotAt,
      });
    } else {
      alive.set(target.id, { ...target, health });
    }
    return {
      ...tower,
      cooldownSteps: Math.max(
        1,
        Math.round(stats.fireIntervalSeconds * stepsPerSecond),
      ),
      aimedAt: at,
    };
  });
  return { towers: nextTowers, dudes: [...alive.values()], events };
}

/** Compares squared distances: no square roots, so the result is exact on every machine. */
function isInRange(tile: Tile, range: number, dude: DudeState): boolean {
  const dx = dude.x - (tile.column + 0.5);
  const dy = dude.y - (tile.row + 0.5);
  return dx * dx + dy * dy <= range * range;
}

function statsOf(pieceId: PieceId): TowerStats {
  const stats = PIECES[pieceId].tower;
  if (stats === null) {
    throw new TowerStatsError(
      `${pieceId} has no tower stats but was made a tower.`,
    );
  }
  return stats;
}
