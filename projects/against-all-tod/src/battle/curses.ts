import { CURSE_RULES, type CurseId } from "../catalog/curses";
import type { Tile } from "../maze/board";
import { placePiece, placedPieces, removePiece, type Maze } from "../maze/maze";
import { createRng, type Rng } from "../rng/rng";
import type { DudeState } from "./dudes";
import type { BattleEvent } from "./events";

/**
 * What the Round's Curse does to a battle. Each answer is neutral (1, true, the event list as
 * it is) without a Curse or under a Curse that doesn't touch it, so the battle asks every one.
 */

/** Rust: the multiplier on the time between a tower's shots. */
export function curseReloadFactor(curse: CurseId | null): number {
  return curse === "rust" ? CURSE_RULES.rustReloadMultiplier : 1;
}

/** Mud: the multiplier on every Dude's speed. */
export function curseSpeedFactor(curse: CurseId | null): number {
  return curse === "mud" ? CURSE_RULES.mudSpeedMultiplier : 1;
}

/** Power Cut switches Lighthouses and Sirens off: no beam, no stun, no light in the dark. */
export function powerOn(curse: CurseId | null): boolean {
  return curse !== "power-cut";
}

/** Stage Fright: Hype Men boost nobody. */
export function hypeMenWork(curse: CurseId | null): boolean {
  return curse !== "stage-fright";
}

/** Union Break: Wall-breakers can't damage Pieces, so they walk the route like everyone else. */
export function wallBreakersBreak(curse: CurseId | null): boolean {
  return curse !== "union-break";
}

/** Audit: Tax Booths still see Dudes cross, but move no gold. */
export function withoutAuditedTax(
  curse: CurseId | null,
  events: BattleEvent[],
): BattleEvent[] {
  return curse === "audit"
    ? events.filter((event) => event.type !== "taxed")
    : events;
}

/**
 * Traffic Jam: the Army's Dudes set off one at a time in paint order (their ids), so a Dude
 * still waits at `step` until its turn comes. Split halves, born later, never wait.
 */
export function waitsInJam(
  curse: CurseId | null,
  dude: DudeState,
  armySize: number,
  step: number,
  stepsPerSecond: number,
): boolean {
  if (curse !== "traffic-jam" || dude.id >= armySize) return false;
  const gapSteps = CURSE_RULES.trafficJamGapSeconds * stepsPerSecond;
  return step < Math.round(dude.id * gapSteps);
}

/** Earthquake's shake: the Piece that moved and where to; null if nothing could move. */
export interface Quake {
  readonly maze: Maze;
  readonly from: Tile;
  readonly to: Tile;
}

const NEIGHBOURS = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
] as const;

/**
 * Earthquake moves one random Piece one tile, onto a free tile next to it where it could be
 * placed (never sealing the Goal). Pieces and directions are tried in a seeded order until one
 * fits, so the same Maze and seed always shake the same way.
 */
export function earthquake(maze: Maze, seed: number): Quake | null {
  const rng = createRng((seed ^ 0x5eed_ea27) >>> 0);
  const pieces = shuffled(
    placedPieces(maze).sort(
      (a, b) => a.tile.row - b.tile.row || a.tile.column - b.tile.column,
    ),
    rng,
  );
  for (const { pieceId, tile } of pieces) {
    const without = removePiece(maze, tile);
    for (const { dx, dy } of shuffled(NEIGHBOURS, rng)) {
      const to = { column: tile.column + dx, row: tile.row + dy };
      const placed = placePiece(without, to, pieceId);
      if (placed.ok) return { maze: placed.maze, from: tile, to };
    }
  }
  return null;
}

/** The Maze the battle is fought on: the Board's, shaken by an Earthquake. */
export function cursedMaze(
  maze: Maze,
  curse: CurseId | null,
  seed: number,
): Maze {
  if (curse !== "earthquake") return maze;
  return earthquake(maze, seed)?.maze ?? maze;
}

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(rng() * (index + 1));
    const swap = result[index] as T;
    result[index] = result[other] as T;
    result[other] = swap;
  }
  return result;
}
