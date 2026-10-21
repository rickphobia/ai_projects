import { TUNING } from "./tuning";
import { dot, type Vector3 } from "./vector";

/**
 * The Plane's velocity after one step on its wheels. The tyres let it roll only where the nose
 * points, rolling friction or the brakes hold it back, and the ground takes whatever weight the
 * wings don't. Any upward force left over lifts it off.
 */
export function rollOnWheels(
  velocity: Vector3,
  force: Vector3,
  heading: number,
  brakes: boolean,
  seconds: number,
): Vector3 {
  const along = { x: Math.sin(heading), y: Math.cos(heading), z: 0 };
  const weightOnWheels = Math.max(0, -force.z);
  const friction =
    (brakes ? TUNING.brakeFriction : TUNING.rollingFriction) * weightOnWheels;
  const speed = nextRollingSpeed(
    dot(velocity, along),
    dot(force, along),
    friction,
    seconds,
  );
  const climb = (Math.max(0, force.z) / TUNING.mass) * seconds;
  return { x: along.x * speed, y: along.y * speed, z: climb };
}

/** Speed along the ground, with friction slowing it but never pushing it backwards. */
function nextRollingSpeed(
  speed: number,
  push: number,
  friction: number,
  seconds: number,
): number {
  const standingStill = Math.abs(speed) < TUNING.stoppedSpeed;
  if (standingStill && Math.abs(push) <= friction) return 0;
  const direction = Math.sign(standingStill ? push : speed);
  const next = speed + ((push - direction * friction) / TUNING.mass) * seconds;
  // Friction alone can stop the Plane, not send it the other way.
  return Math.sign(next) === -direction ? 0 : next;
}
