import { TUNING } from "./tuning";

/** What the wing is set up for and doing: how far the flaps are down, and whether it has Stalled. */
export interface WingState {
  readonly flaps: number;
  readonly stalled: boolean;
}

/**
 * Whether the wing is Stalled. It Stalls past the critical angle of attack, and once Stalled the
 * airflow only reattaches a little below it, so holding the nose up keeps it Stalled rather than
 * flicking in and out every step.
 */
export function wingStalled(
  angleOfAttack: number,
  wasStalled: boolean,
): boolean {
  const limit = wasStalled
    ? TUNING.criticalAngleOfAttack - TUNING.stallRecoveryMargin
    : TUNING.criticalAngleOfAttack;
  return angleOfAttack > limit;
}

/**
 * Lift coefficient: it grows with angle of attack up to the critical angle and no further. A
 * Stalled wing keeps only a share of it. Flaps add lift at every angle, which is what lowers
 * the Stall speed.
 */
export function liftCoefficient(
  angleOfAttack: number,
  wing: WingState,
): number {
  const lift = Math.max(
    TUNING.minLift,
    TUNING.liftAtZeroAngle +
      TUNING.flapLiftPerRadian * wing.flaps +
      TUNING.liftPerRadian *
        Math.min(angleOfAttack, TUNING.criticalAngleOfAttack),
  );
  return wing.stalled ? lift * TUNING.stalledLiftShare : lift;
}

/** Drag coefficient: a fixed part, the flaps' share, and the drag that comes with making lift. */
export function dragCoefficient(lift: number, wing: WingState): number {
  return (
    TUNING.parasiteDrag +
    TUNING.flapDragPerRadian * wing.flaps +
    TUNING.inducedDrag * lift * lift
  );
}
