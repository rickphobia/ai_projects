import { beamAngle } from "../../battle/area-effects";
import {
  STEPS_PER_SECOND,
  turnstilesTurned,
  type BattleState,
} from "../../battle/battle";
import type { BoardPoint } from "../../battle/events";
import { PIECES } from "../../catalog/pieces";
import { tileKey } from "../../maze/board";
import type { Turrets } from "./pieces-view";

/** Kenney's turret sprites face up; PixiJS measures rotation from the right. */
const SPRITE_FACING = Math.PI / 2;

/**
 * Turns each tower's turret toward its last shot, and the Pieces that follow the battle clock
 * (Lighthouse lamps, Turnstile arms) to where the clock has them.
 */
export function aimTurrets(turrets: Turrets, state: BattleState): void {
  turnByClock(turrets, state.step);
  for (const tower of state.towers) {
    const turret = turrets.get(tileKey(tower.tile))?.turret;
    if (turret === undefined || tower.aimedAt === null) continue;
    turret.rotation = facing(
      tower.tile.column + 0.5,
      tower.tile.row + 0.5,
      tower.aimedAt,
      turret.rotation,
    );
  }
}

/** Turns the Pieces that follow the battle clock: Lighthouse lamps along their beam, Turnstile arms. */
function turnByClock(turrets: Turrets, step: number): void {
  const turned = turnstilesTurned(step);
  for (const { pieceId, turret } of turrets.values()) {
    const beam = PIECES[pieceId].beam;
    if (beam !== null) {
      turret.rotation = beamAngle(beam, step, STEPS_PER_SECOND) + SPRITE_FACING;
    } else if (PIECES[pieceId].turnIntervalSeconds !== null) {
      turret.rotation = turned ? Math.PI / 2 : 0;
    }
  }
}

/** The rotation that points a sprite from (fromX, fromY) to `to`; the old one when they are the same point. */
function facing(
  fromX: number,
  fromY: number,
  to: BoardPoint,
  current: number,
): number {
  const dx = to.x - fromX;
  const dy = to.y - fromY;
  if (dx === 0 && dy === 0) return current;
  return Math.atan2(dy, dx) + SPRITE_FACING;
}
