import { airflow, bodyAxes } from "./attitude";
import type { Plane } from "./plane";

/**
 * The flight model has no engine, so RPM comes from the throttle, plus a little windmilling
 * from the airflow, between a C172's idle and redline.
 */
export const IDLE_RPM = 700;
const FULL_THROTTLE_RPM = 2400;
/** 3 RPM per knot of airspeed. */
const WINDMILL_RPM_PER_METRE_PER_SECOND = 3 * 1.943844;
export const REDLINE_RPM = 2700;

export function engineRpm(plane: Plane): number {
  const airspeed = airflow(plane.velocity, bodyAxes(plane)).speed;
  const rpm =
    IDLE_RPM +
    plane.throttle * (FULL_THROTTLE_RPM - IDLE_RPM) +
    airspeed * WINDMILL_RPM_PER_METRE_PER_SECOND;
  return Math.min(Math.max(rpm, 0), REDLINE_RPM);
}
