import type { Airflow, BodyAxes } from "./attitude";
import { TUNING } from "./tuning";
import { add, dot, normalize, scale, type Vector3, ZERO } from "./vector";

/** Below this airspeed the air does nothing worth computing, and its directions aren't defined. */
const STILL_AIR_SPEED = 0.1;

/** The sum of lift, drag, side force, thrust and weight on the Plane, in newtons. */
export function totalForce(
  velocity: Vector3,
  axes: BodyAxes,
  air: Airflow,
  throttle: number,
): Vector3 {
  const weight = { x: 0, y: 0, z: -TUNING.mass * TUNING.gravity };
  return add(
    aerodynamicForce(velocity, axes, air),
    scale(axes.forward, thrust(throttle, air.speed)),
    weight,
  );
}

function thrust(throttle: number, airspeed: number): number {
  // A fixed-pitch propeller pulls hardest standing still and less as the air speeds past it.
  const fade = Math.max(0, 1 - airspeed / TUNING.thrustFadeSpeed);
  return throttle * TUNING.staticThrust * fade;
}

function aerodynamicForce(
  velocity: Vector3,
  axes: BodyAxes,
  air: Airflow,
): Vector3 {
  if (air.speed < STILL_AIR_SPEED) return ZERO;
  const pressureTimesArea =
    0.5 * TUNING.airDensity * air.speed * air.speed * TUNING.wingArea;
  const airflowDirection = scale(velocity, 1 / air.speed);
  const lift = liftCoefficient(air.angleOfAttack);
  const drag = TUNING.parasiteDrag + TUNING.inducedDrag * lift * lift;
  return add(
    scale(perpendicularTo(airflowDirection, axes.up), pressureTimesArea * lift),
    scale(airflowDirection, -pressureTimesArea * drag),
    scale(
      perpendicularTo(airflowDirection, axes.right),
      -pressureTimesArea * TUNING.sideForce * air.sideslip,
    ),
  );
}

function liftCoefficient(angleOfAttack: number): number {
  const lift = TUNING.liftAtZeroAngle + TUNING.liftPerRadian * angleOfAttack;
  return Math.max(TUNING.minLift, Math.min(TUNING.maxLift, lift));
}

/** The part of `axis` at right angles to the airflow, made length 1: lift acts across the airflow, not along it. */
function perpendicularTo(airflowDirection: Vector3, axis: Vector3): Vector3 {
  return normalize(
    add(axis, scale(airflowDirection, -dot(axis, airflowDirection))),
  );
}
