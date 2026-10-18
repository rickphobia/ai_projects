import { DUDE_KINDS } from "../catalog/dudes";
import { PIECES, type PieceId, type TowerStats } from "../catalog/pieces";
import { BOARD_COLUMNS, BOARD_ROWS, type Tile } from "../maze/board";
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
      outranks(candidate.size, candidate.distanceToGoal, candidate.id, best)
    ) {
      best = candidate;
    }
  }
  return best?.id ?? null;
}

/**
 * True when a Dude of this size, distance and id is a better target than `best`. A strict
 * order, so the choice never depends on the order Dudes are looked at in.
 */
function outranks(
  size: number,
  distanceToGoal: number,
  id: number,
  best: TargetCandidate,
): boolean {
  if (size !== best.size) return size > best.size;
  if (distanceToGoal !== best.distanceToGoal) {
    return distanceToGoal < best.distanceToGoal;
  }
  return id < best.id;
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
  const byTile = dudesByTile(dudes);
  // Only the Dudes a shot hit get a new state; null marks a kill.
  const hit = new Map<number, DudeState | null>();
  const events: BattleEvent[] = [];
  const nextTowers = towers.map((tower): TowerState => {
    const stats = statsOf(tower.pieceId);
    if (tower.cooldownSteps > 1) {
      return { ...tower, cooldownSteps: tower.cooldownSteps - 1 };
    }
    const target = targetFor(tower.tile, stats.range, byTile, hit, route);
    if (target === null) return { ...tower, cooldownSteps: 0 };

    const at = { x: target.x, y: target.y };
    const shotAt = { step, pieceId: tower.pieceId, pieceTile: tower.tile, at };
    events.push({ type: "shot", dudeId: target.id, ...shotAt });
    const health = target.health - stats.damage;
    if (health <= 0) {
      hit.set(target.id, null);
      events.push({
        type: "kill",
        dudeId: target.id,
        dudeKind: target.kind,
        ...shotAt,
      });
    } else {
      hit.set(target.id, { ...target, health });
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
  return { towers: nextTowers, dudes: afterHits(dudes, hit), events };
}

/**
 * The tower's pick among the living Dudes in range. It looks only at the tiles its range
 * reaches, so its cost grows with the Dudes near it rather than with the whole Army.
 */
function targetFor(
  tile: Tile,
  range: number,
  byTile: readonly (readonly DudeState[])[],
  hit: ReadonlyMap<number, DudeState | null>,
  route: Route,
): DudeState | null {
  const centreX = tile.column + 0.5;
  const centreY = tile.row + 0.5;
  const firstColumn = Math.max(0, Math.floor(centreX - range));
  const lastColumn = Math.min(BOARD_COLUMNS - 1, Math.floor(centreX + range));
  const firstRow = Math.max(0, Math.floor(centreY - range));
  const lastRow = Math.min(BOARD_ROWS - 1, Math.floor(centreY + range));
  let best: { dude: DudeState; candidate: TargetCandidate } | null = null;
  for (let row = firstRow; row <= lastRow; row++) {
    for (let column = firstColumn; column <= lastColumn; column++) {
      const here = byTile[row * BOARD_COLUMNS + column] ?? [];
      if (here.length === 0) continue;
      const stepsLeft = distanceToGoal(route, { column, row }) ?? Infinity;
      for (const placed of here) {
        const dude = hit.has(placed.id) ? hit.get(placed.id) : placed;
        if (dude == null || !isInRange(centreX, centreY, range, dude)) {
          continue;
        }
        const size = DUDE_KINDS[dude.kind].size;
        if (
          best === null ||
          outranks(size, stepsLeft, dude.id, best.candidate)
        ) {
          best = {
            dude,
            candidate: { id: dude.id, size, distanceToGoal: stepsLeft },
          };
        }
      }
    }
  }
  return best?.dude ?? null;
}

/** The Dudes standing on each tile, by tile index (row by row from the top left). */
function dudesByTile(dudes: readonly DudeState[]): DudeState[][] {
  const byTile = Array.from(
    { length: BOARD_COLUMNS * BOARD_ROWS },
    (): DudeState[] => [],
  );
  for (const dude of dudes) {
    const { column, row } = tileUnder(dude);
    byTile[row * BOARD_COLUMNS + column]?.push(dude);
  }
  return byTile;
}

/** The Dudes in their order, with the hit ones changed and the killed ones gone. */
function afterHits(
  dudes: readonly DudeState[],
  hit: ReadonlyMap<number, DudeState | null>,
): DudeState[] {
  if (hit.size === 0) return [...dudes];
  const alive: DudeState[] = [];
  for (const dude of dudes) {
    const now = hit.has(dude.id) ? hit.get(dude.id) : dude;
    if (now != null) alive.push(now);
  }
  return alive;
}

/** Compares squared distances: no square roots, so the result is exact on every machine. */
function isInRange(
  centreX: number,
  centreY: number,
  range: number,
  dude: DudeState,
): boolean {
  const dx = dude.x - centreX;
  const dy = dude.y - centreY;
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
