import {
  PIECES,
  type BeamStats,
  type PieceId,
  type StunStats,
} from "../catalog/pieces";
import { tileKey, type Tile } from "../maze/board";
import { placedPieces, type Maze } from "../maze/maze";
import type { DudeState } from "./dudes";
import type { BattleEvent } from "./events";

/**
 * The Lighthouse's beam and the Siren's stun. Both follow the battle clock alone (the beam's
 * angle and the Siren's pulses are worked out from the step), so they need no state of their own.
 */

/** The Volume trick's middle position: Sirens at their catalog range. */
export const NEUTRAL_VOLUME = 0;

/** A Piece that sweeps a beam or pulses a stun, top row first so they always act in the same order. */
export interface EffectPiece {
  readonly pieceId: PieceId;
  readonly tile: Tile;
}

export function effectPiecesOf(maze: Maze): EffectPiece[] {
  return placedPieces(maze)
    .filter(
      ({ pieceId }) =>
        PIECES[pieceId].beam !== null || PIECES[pieceId].stun !== null,
    )
    .sort((a, b) => a.tile.row - b.tile.row || a.tile.column - b.tile.column);
}

/** Where the beam points at `step`, in radians clockwise from pointing right (y grows down). */
export function beamAngle(
  stats: BeamStats,
  step: number,
  stepsPerSecond: number,
): number {
  return (
    (((stats.sweepDegreesPerSecond * step) / stepsPerSecond) % 360) *
    (Math.PI / 180)
  );
}

/** A Siren's reach at a Volume position (negative is down); never below zero. */
export function sirenRange(stats: StunStats, volume: number): number {
  return Math.max(0, stats.range * (1 + stats.rangePerVolumeStep * volume));
}

/** Every tile a Lighthouse lights, by `tileKey`. Darkness (a later ticket) spares these. */
export function litTiles(maze: Maze): Set<string> {
  const lit = new Set<string>();
  for (const { pieceId, tile } of placedPieces(maze)) {
    const radius = PIECES[pieceId].beam?.lightRadius;
    if (radius === undefined) continue;
    const reach = Math.floor(radius);
    for (let row = tile.row - reach; row <= tile.row + reach; row++) {
      for (
        let column = tile.column - reach;
        column <= tile.column + reach;
        column++
      ) {
        const dx = column - tile.column;
        const dy = row - tile.row;
        if (dx * dx + dy * dy <= radius * radius)
          lit.add(tileKey({ column, row }));
      }
    }
  }
  return lit;
}

export interface EffectsResult {
  /** The Dudes still alive. */
  readonly dudes: DudeState[];
  readonly events: BattleEvent[];
}

/** Every beam hurts the Dudes it touches, then every Siren whose pulse is due stuns the Dudes in range. */
export function applyEffects(
  pieces: readonly EffectPiece[],
  dudes: readonly DudeState[],
  step: number,
  stepsPerSecond: number,
  volume: number,
): EffectsResult {
  let current = [...dudes];
  const events: BattleEvent[] = [];
  for (const piece of pieces) {
    const { beam, stun } = PIECES[piece.pieceId];
    if (beam !== null) {
      current = sweep(piece, beam, current, step, stepsPerSecond, events);
    }
    if (stun !== null) {
      current = pulse(stun, piece.tile, current, step, stepsPerSecond, volume);
    }
  }
  return { dudes: current, events };
}

function sweep(
  piece: EffectPiece,
  stats: BeamStats,
  dudes: readonly DudeState[],
  step: number,
  stepsPerSecond: number,
  events: BattleEvent[],
): DudeState[] {
  const angle = beamAngle(stats, step, stepsPerSecond);
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const minCos = Math.cos((stats.halfWidthDegrees * Math.PI) / 180);
  const damage = stats.damagePerSecond / stepsPerSecond;
  const centreX = piece.tile.column + 0.5;
  const centreY = piece.tile.row + 0.5;
  const alive: DudeState[] = [];
  for (const dude of dudes) {
    const dx = dude.x - centreX;
    const dy = dude.y - centreY;
    const squared = dx * dx + dy * dy;
    const along = dx * dirX + dy * dirY;
    // In the beam: within range, in front, and inside its width (compared squared, no roots).
    const inBeam =
      squared <= stats.range * stats.range &&
      along > 0 &&
      along * along >= minCos * minCos * squared;
    if (!inBeam) {
      alive.push(dude);
      continue;
    }
    const health = dude.health - damage;
    if (health > 0) {
      alive.push({ ...dude, health });
      continue;
    }
    events.push({
      type: "kill",
      step,
      pieceId: piece.pieceId,
      pieceTile: piece.tile,
      dudeId: dude.id,
      dudeKind: dude.kind,
      at: { x: dude.x, y: dude.y },
    });
  }
  return alive;
}

function pulse(
  stats: StunStats,
  tile: Tile,
  dudes: DudeState[],
  step: number,
  stepsPerSecond: number,
  volume: number,
): DudeState[] {
  const interval = Math.max(
    1,
    Math.round(stats.intervalSeconds * stepsPerSecond),
  );
  if (step % interval !== 0) return dudes;
  const range = sirenRange(stats, volume);
  const stunnedUntilStep =
    step + Math.round(stats.stunSeconds * stepsPerSecond);
  const centreX = tile.column + 0.5;
  const centreY = tile.row + 0.5;
  return dudes.map((dude) => {
    const dx = dude.x - centreX;
    const dy = dude.y - centreY;
    if (dx * dx + dy * dy > range * range) return dude;
    return {
      ...dude,
      stunnedUntilStep: Math.max(dude.stunnedUntilStep ?? 0, stunnedUntilStep),
    };
  });
}
