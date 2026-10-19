import {
  BOSS_RULES,
  HR_PIECE,
  LANDLORD_KIND,
  type BossId,
} from "../catalog/bosses";
import { DUDE_KINDS, isBoss } from "../catalog/dudes";
import { allTiles, tileKey, type Tile } from "../maze/board";
import { placedPieces, placePiece, type Maze } from "../maze/maze";
import { distanceToGoal } from "../maze/route";
import { newDude, squaredDistance, type DudeState } from "./dudes";
import type { BattleEvent } from "./events";
import type { PieceHits } from "./wall-breakers";

/**
 * What a Boss Round's boss does to a battle. The Landlord walks with the Army as a Dude of his own
 * kind; the HR Department stands in the Maze as a Piece of its own. Both are added to the battle
 * only, so the Board and the Army the Run keeps never hold them.
 */

/** The Landlord as he stands in the Spawn zone at step 0, with the next free Dude id. */
export function landlordDude(id: number): DudeState {
  return { ...newDude(id, LANDLORD_KIND, BOSS_RULES.landlordStart), walked: 0 };
}

/** The Dudes the battle starts with: the Army's, plus The Landlord on his Boss Round. */
export function withBossDude(
  dudes: readonly DudeState[],
  boss: BossId | null,
): DudeState[] {
  return boss === "landlord"
    ? [...dudes, landlordDude(dudes.length)]
    : [...dudes];
}

/** The Maze the battle is fought on: with the HR Department on its Boss Round. */
export function withBossPiece(maze: Maze, boss: BossId | null): Maze {
  if (boss !== "hr-department") return maze;
  const tile = hrTile(maze);
  if (tile === null) return maze;
  const placed = placePiece(maze, tile, HR_PIECE);
  return placed.ok ? placed.maze : maze;
}

/**
 * Where the HR Department stands: the free tile nearest the Goal by route, where every
 * Wall-breaker must pass in the end. Ties go to the top, then the left, so a Maze always gets
 * the same tile. It is a floor Piece, so it never changes the route or seals the Goal. Null on a
 * Maze with no free tile on the route.
 */
export function hrTile(maze: Maze): Tile | null {
  let best: { tile: Tile; distance: number } | null = null;
  for (const tile of allTiles(maze.windowSize)) {
    const distance = distanceToGoal(maze.route, tile);
    if (distance === null || distance === 0) continue;
    if (maze.pieces.has(tileKey(tile))) continue;
    if (!placePiece(maze, tile, HR_PIECE).ok) continue;
    if (best === null || distance < best.distance) best = { tile, distance };
  }
  return best?.tile ?? null;
}

/**
 * The Landlord after a step's walk: he counts the tiles he has walked, and each time the count
 * passes another `landlordEvictEveryTiles` he evicts the standing Piece nearest him. Taking a
 * Piece away only ever opens the Maze, so an eviction can't seal the Goal. Other Dudes come back
 * as they are.
 */
export function walkLandlord(
  before: DudeState,
  moved: DudeState,
  maze: Maze,
  pieceHits: PieceHits,
  step: number,
  events: BattleEvent[],
): DudeState {
  if (moved.kind !== LANDLORD_KIND) return moved;
  const walkedBefore = moved.walked ?? 0;
  const walked = walkedBefore + Math.sqrt(squaredDistance(before, moved));
  const every = BOSS_RULES.landlordEvictEveryTiles;
  if (Math.floor(walked / every) > Math.floor(walkedBefore / every)) {
    const evicted = evictNearest(moved, maze, pieceHits, step);
    if (evicted !== null) events.push(evicted);
  }
  return { ...moved, walked };
}

/**
 * The tiles of the Pieces a battle destroyed for good: those Wall-breakers broke. The Landlord's
 * evictions last for his battle only, like him, so the Board the Run keeps gets them back.
 */
export function destroyedForGood(events: readonly BattleEvent[]): Tile[] {
  return events.flatMap((event) =>
    event.type === "piece-destroyed" && !isBoss(event.dudeKind)
      ? [event.pieceTile]
      : [],
  );
}

function evictNearest(
  landlord: DudeState,
  maze: Maze,
  pieceHits: PieceHits,
  step: number,
): BattleEvent | null {
  const byDistance = placedPieces(maze)
    .map((piece) => ({
      piece,
      distance: squaredDistance(landlord, {
        x: piece.tile.column + 0.5,
        y: piece.tile.row + 0.5,
      }),
    }))
    .sort(
      (a, b) =>
        a.distance - b.distance ||
        a.piece.tile.row - b.piece.tile.row ||
        a.piece.tile.column - b.piece.tile.column,
    );
  for (const { piece } of byDistance) {
    // A Piece a Wall-breaker destroyed earlier this step is skipped.
    if (!pieceHits.damage(piece, Infinity)) continue;
    return {
      type: "piece-destroyed",
      step,
      pieceId: piece.pieceId,
      pieceTile: piece.tile,
      dudeId: landlord.id,
      dudeKind: landlord.kind,
    };
  }
  return null;
}

/**
 * The HR Department sends one Wall-breaker in range back to where it stood in the Spawn zone,
 * then waits `hrIntervalSeconds`. It picks the one nearest it, the lowest id on a tie. Flying and
 * underground Dudes are out of its reach. `cooldowns` is the battle's trap cooldowns, by tile.
 */
export function turnBack(
  maze: Maze,
  dudes: readonly DudeState[],
  cooldowns: Map<string, number>,
  step: number,
  stepsPerSecond: number,
): DudeState[] {
  const result = [...dudes];
  for (const piece of placedPieces(maze)) {
    if (piece.pieceId !== HR_PIECE) continue;
    const key = tileKey(piece.tile);
    if ((cooldowns.get(key) ?? 0) > step) continue;
    const centre = { x: piece.tile.column + 0.5, y: piece.tile.row + 0.5 };
    let nearest: { index: number; distance: number } | null = null;
    for (const [index, dude] of result.entries()) {
      const kind = DUDE_KINDS[dude.kind];
      if (kind.wallBreaker === null || kind.flies || dude.burrowTo !== null) {
        continue;
      }
      const distance = squaredDistance(dude, centre);
      if (distance > BOSS_RULES.hrRange ** 2) continue;
      if (nearest === null || distance < nearest.distance) {
        nearest = { index, distance };
      }
    }
    if (nearest === null) continue;
    const sent = result[nearest.index];
    if (sent === undefined) continue;
    result[nearest.index] = { ...sent, x: sent.start.x, y: sent.start.y };
    cooldowns.set(
      key,
      step + Math.round(BOSS_RULES.hrIntervalSeconds * stepsPerSecond),
    );
  }
  return result;
}
