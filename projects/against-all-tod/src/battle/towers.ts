import { DUDE_KINDS } from "../catalog/dudes";
import { PIECES, type PieceId, type TowerStats } from "../catalog/pieces";
import { BOARD_COLUMNS, BOARD_ROWS, type Tile } from "../maze/board";
import { placedPieces, type Maze } from "../maze/maze";
import { distanceToGoal, type Route } from "../maze/route";
import { DudeHits } from "./damage";
import { squaredDistance, tileUnder, type DudeState } from "./dudes";
import type { BattleEvent, BoardPoint } from "./events";
import { NO_TOWER_TRICKS, type TowerTricks } from "./tricks";

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
  /** A breaking Explosive Shield stunned it: it does nothing until this step. Absent if never stunned. */
  readonly stunnedUntilStep?: number;
}

/** What a Sniper Nest weighs when choosing whom to shoot. */
export interface TargetCandidate {
  readonly id: number;
  readonly size: number;
  /** Route steps left to the Goal. */
  readonly distanceToGoal: number;
  /** True for a Streaker, whom every tower shoots first. */
  readonly drawsFire?: boolean;
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
 * The Sniper Nest's choice: any Streaker first, then the biggest Dude, then the one closest to the Goal, then the one
 * that entered first. Null when there is no one to shoot.
 */
export function pickTarget(
  candidates: readonly TargetCandidate[],
): number | null {
  let best: TargetCandidate | null = null;
  for (const candidate of candidates) {
    if (best === null || outranks(candidate, best)) {
      best = candidate;
    }
  }
  return best?.id ?? null;
}

/**
 * True when `candidate` is a better target than `best`. A strict order, so the choice never
 * depends on the order Dudes are looked at in.
 */
function outranks(candidate: TargetCandidate, best: TargetCandidate): boolean {
  const drawsFire = candidate.drawsFire ?? false;
  if (drawsFire !== (best.drawsFire ?? false)) return drawsFire;
  if (candidate.size !== best.size) return candidate.size > best.size;
  if (candidate.distanceToGoal !== best.distanceToGoal) {
    return candidate.distanceToGoal < best.distanceToGoal;
  }
  return candidate.id < best.id;
}

export interface VolleyResult {
  readonly towers: TowerState[];
  /** The Dudes still alive. */
  readonly dudes: DudeState[];
  readonly events: BattleEvent[];
}

/**
 * Every ready tower shoots once, in order, each seeing the damage the ones before it did. A shot
 * at a Dude just behind a Shield Bro with his shield up hits the shield instead.
 */
export function fireTowers(
  towers: readonly TowerState[],
  dudes: readonly DudeState[],
  route: Route,
  step: number,
  stepsPerSecond: number,
  tricks: TowerTricks = NO_TOWER_TRICKS,
): VolleyResult {
  const byTile = dudesByTile(dudes);
  const events: BattleEvent[] = [];
  const hits = new DudeHits(dudes, step, events);
  const shieldBearers = dudes.filter((dude) => dude.shield > 0);
  const nextTowers = towers.map((tower): TowerState => {
    if ((tower.stunnedUntilStep ?? 0) > step) return tower;
    const stats = statsOf(tower.pieceId);
    if (tower.cooldownSteps > 1) {
      return { ...tower, cooldownSteps: tower.cooldownSteps - 1 };
    }
    const range = Math.min(
      stats.range * tricks.rangeFactor(tower.tile),
      tricks.sightTiles,
    );
    const aimed = targetFor(
      tower.tile,
      range,
      stats.hitsAir,
      byTile,
      hits,
      route,
    );
    if (aimed === null) return { ...tower, cooldownSteps: 0 };
    const shield = shieldCovering(aimed, shieldBearers, hits);
    const target = shield ?? aimed;

    const at = { x: target.x, y: target.y };
    events.push({
      type: "shot",
      step,
      pieceId: tower.pieceId,
      pieceTile: tower.tile,
      dudeId: target.id,
      at,
    });
    if (shield !== null) {
      hits.record({
        ...shield,
        shield: Math.max(0, shield.shield - stats.damage),
      });
    } else {
      hits.hurt(target, stats.damage, {
        pieceId: tower.pieceId,
        pieceTile: tower.tile,
      });
    }
    const interval = stats.fireIntervalSeconds * tricks.reloadFactor;
    return reloaded(tower, interval, stepsPerSecond, at);
  });
  return { towers: nextTowers, dudes: hits.applyTo(dudes), events };
}

function reloaded(
  tower: TowerState,
  intervalSeconds: number,
  stepsPerSecond: number,
  aimedAt: BoardPoint,
): TowerState {
  return {
    ...tower,
    cooldownSteps: Math.max(1, Math.round(intervalSeconds * stepsPerSecond)),
    aimedAt,
  };
}

/**
 * The Shield Bro whose shield takes a shot aimed at `target`: one still standing with his
 * shield up, within its radius and nearer the Goal (which is always to the right). He never
 * shields himself. Null when no shield covers the target.
 */
function shieldCovering(
  target: DudeState,
  bearers: readonly DudeState[],
  hits: DudeHits,
): DudeState | null {
  for (const placed of bearers) {
    const bearer = hits.current(placed);
    if (bearer === null || bearer.id === target.id || bearer.shield <= 0) {
      continue;
    }
    const radius = DUDE_KINDS[bearer.kind].shield?.radius ?? 0;
    if (
      bearer.x > target.x &&
      squaredDistance(bearer, target) <= radius * radius
    ) {
      return bearer;
    }
  }
  return null;
}

/**
 * The tower's pick among the living Dudes it can hit in range: never one underground, and a
 * flyer only if the tower hits air. It looks only at the tiles its range reaches, so its cost
 * grows with the Dudes near it rather than with the whole Army.
 */
function targetFor(
  tile: Tile,
  range: number,
  hitsAir: boolean,
  byTile: readonly (readonly DudeState[])[],
  hits: DudeHits,
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
        const dude = hits.current(placed);
        if (dude === null || !isInRange(centreX, centreY, range, dude)) {
          continue;
        }
        const kind = DUDE_KINDS[dude.kind];
        if (dude.burrowTo !== null || (kind.flies && !hitsAir)) continue;
        const candidate = {
          id: dude.id,
          size: kind.size,
          distanceToGoal: stepsLeft,
          drawsFire: kind.drawsFire,
        };
        if (best === null || outranks(candidate, best.candidate)) {
          best = { dude, candidate };
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
