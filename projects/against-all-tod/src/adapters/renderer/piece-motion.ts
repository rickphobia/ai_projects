import { beamAngle, sirenRange } from "../../battle/area-effects";
import {
  STEPS_PER_SECOND,
  turnstilesTurned,
  type BattleState,
} from "../../battle/battle";
import type { BoardPoint } from "../../battle/events";
import { PIECES, type StunStats } from "../../catalog/pieces";
import { tileKey } from "../../maze/board";
import type { MovingParts } from "./pieces-view";

/** A Siren's ring grows from this share of its reach to all of it, fading as it goes. */
const RING_START_SCALE = 0.15;
const RING_SECONDS = 0.6;
/** How fast a Grinder's teeth spin while it isn't jammed. */
const GRINDER_TURNS_PER_SECOND = 1.5;

/** How a Siren's ring looks at a battle step: the pose of one sprite. */
export interface RingPose {
  readonly visible: boolean;
  readonly scale: number;
  readonly alpha: number;
}

/**
 * Moves each Piece's working part to where the battle has it, by sprite transforms only: tower
 * barrels toward their last shot, Lighthouse beams along their sweep, Turnstile arms with their
 * turn, Siren rings out from each pulse and Grinder teeth round unless jammed. A Lighthouse or
 * Siren the battle has switched off (Power Cut) shows no beam and no rings. `volume` is the
 * Volume trick's position, which sets how far a Siren reaches.
 */
export function moveParts(
  parts: MovingParts,
  state: BattleState,
  volume: number,
): void {
  const working = new Set(state.effectPieces.map(({ tile }) => tileKey(tile)));
  const turned = turnstilesTurned(state.step);
  for (const [key, { pieceId, part }] of parts) {
    const { beam, stun, trap, turnIntervalSeconds } = PIECES[pieceId];
    if (beam !== null) {
      part.visible = working.has(key);
      part.rotation = beamAngle(beam, state.step, STEPS_PER_SECOND);
    } else if (stun !== null) {
      const ring = working.has(key)
        ? sirenRing(stun, state.step, STEPS_PER_SECOND, volume)
        : { visible: false, scale: 1, alpha: 0 };
      part.visible = ring.visible;
      part.scale.set(ring.scale);
      part.alpha = ring.alpha;
    } else if (turnIntervalSeconds !== null) {
      part.rotation = turned ? Math.PI / 2 : 0;
    } else if (trap?.kind === "grinder") {
      const jammed = (state.trapCooldowns.get(key) ?? 0) > state.step;
      if (!jammed) {
        part.rotation =
          (state.step / STEPS_PER_SECOND) *
          GRINDER_TURNS_PER_SECOND *
          2 *
          Math.PI;
      }
    }
  }
  for (const tower of state.towers) {
    const barrel = parts.get(tileKey(tower.tile))?.part;
    if (barrel === undefined || tower.aimedAt === null) continue;
    barrel.rotation = facing(
      tower.tile.column + 0.5,
      tower.tile.row + 0.5,
      tower.aimedAt,
      barrel.rotation,
    );
  }
}

/**
 * A ring starts at each pulse the battle fires (every `intervalSeconds`, from step 0) and grows
 * over `RING_SECONDS` out to the Siren's reach at this Volume; the texture is drawn at neutral
 * Volume's reach, so scale 1 is that.
 */
export function sirenRing(
  stats: StunStats,
  step: number,
  stepsPerSecond: number,
  volume: number,
): RingPose {
  const reach = sirenRange(stats, volume) / stats.range;
  const interval = Math.max(
    1,
    Math.round(stats.intervalSeconds * stepsPerSecond),
  );
  const ringSteps = Math.max(1, Math.round(RING_SECONDS * stepsPerSecond));
  const sincePulse = step % interval;
  if (sincePulse >= ringSteps) return { visible: false, scale: 1, alpha: 0 };
  const progress = sincePulse / ringSteps;
  return {
    visible: true,
    scale: reach * (RING_START_SCALE + (1 - RING_START_SCALE) * progress),
    alpha: 1 - progress,
  };
}

/** The rotation that points a part drawn facing right from (fromX, fromY) to `to`; the old one when they are the same point. */
function facing(
  fromX: number,
  fromY: number,
  to: BoardPoint,
  current: number,
): number {
  const dx = to.x - fromX;
  const dy = to.y - fromY;
  if (dx === 0 && dy === 0) return current;
  return Math.atan2(dy, dx);
}
