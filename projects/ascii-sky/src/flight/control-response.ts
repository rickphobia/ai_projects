import type { Action, Controls } from "../game/controls";
import type { Airflow, BodyRates } from "./attitude";
import { TUNING } from "./tuning";

/** How much the controls bite at this airspeed: nothing standing still, 1 at the control speed. */
export function controlAuthority(airspeed: number): number {
  const ratio = airspeed / TUNING.controlSpeed;
  return Math.min(TUNING.maxControlAuthority, ratio * ratio);
}

/** What the Plane is doing this step, as far as its response to the controls goes. */
export interface Situation {
  readonly air: Airflow;
  /** How fast the flight path is curving upward, radians per second; negative curving down. */
  readonly pathPitchRate: number;
  readonly roll: number;
  readonly onGround: boolean;
  readonly stalled: boolean;
}

/**
 * The Plane's turning rates after one step: each moves toward what the controls and the
 * airflow ask for, smoothed so a key press eases in rather than snapping.
 */
export function respondToControls(
  rates: BodyRates,
  controls: Controls,
  situation: Situation,
  seconds: number,
): BodyRates {
  const { air, onGround } = situation;
  const authority = controlAuthority(air.speed);
  const target = onGround
    ? groundTarget(controls, air, authority)
    : airTarget(controls, situation, authority);
  const ease = Math.min(1, seconds / TUNING.rateResponseSeconds);
  return {
    // The wheels keep the wings level on the ground.
    rollRate: onGround
      ? 0
      : rates.rollRate + (target.rollRate - rates.rollRate) * ease,
    pitchRate: rates.pitchRate + (target.pitchRate - rates.pitchRate) * ease,
    yawRate: rates.yawRate + (target.yawRate - rates.yawRate) * ease,
  };
}

function airTarget(
  controls: Controls,
  { air, pathPitchRate, roll, stalled }: Situation,
  authority: number,
): BodyRates {
  // A Stalled wing drops the nose on its own, more than the slow-flying elevator can hold up.
  const stallDrop = stalled ? TUNING.stallNoseDropRate : 0;
  return {
    rollRate:
      (axis(controls, "rollRight", "rollLeft") * TUNING.rollRate -
        TUNING.bankStability * roll) *
      authority,
    // Leaning against the flight path's swings damps the slow climb-and-dive a real Plane wanders into.
    pitchRate:
      (pitchTarget(controls, air) - TUNING.pathDamping * pathPitchRate) *
        authority -
      stallDrop,
    yawRate:
      (TUNING.yawStability * air.sideslip +
        axis(controls, "rudderRight", "rudderLeft") * TUNING.rudderRate) *
      authority,
  };
}

function groundTarget(
  controls: Controls,
  air: Airflow,
  authority: number,
): BodyRates {
  // Too slow to hold the nose up with the elevator, its weight sets it back on the nosewheel.
  const noseSettle = TUNING.noseSettleRate * Math.max(0, 1 - authority);
  const steering = Math.min(
    TUNING.maxGroundSteerRate,
    TUNING.groundSteerPerSpeed * air.speed,
  );
  return {
    rollRate: 0,
    pitchRate: pitchTarget(controls, air) * authority - noseSettle,
    yawRate: axis(controls, "rudderRight", "rudderLeft") * steering,
  };
}

/** The elevator, plus the tail's pull back toward the trimmed angle of attack. */
function pitchTarget(controls: Controls, air: Airflow): number {
  return (
    axis(controls, "pitchUp", "pitchDown") * TUNING.pitchRate -
    TUNING.pitchStability * (air.angleOfAttack - TUNING.trimAngleOfAttack)
  );
}

/** +1, -1 or 0 for a pair of opposite controls; both held cancel out. */
export function axis(
  controls: Controls,
  positive: Action,
  negative: Action,
): number {
  return (controls.has(positive) ? 1 : 0) - (controls.has(negative) ? 1 : 0);
}
