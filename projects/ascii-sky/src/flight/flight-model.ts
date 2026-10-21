import type { Controls } from "../game/controls";
import type { World } from "../world/world";
import {
  type Attitude,
  airflow,
  bodyAxes,
  type BodyRates,
  turn,
} from "./attitude";
import { axis, respondToControls } from "./control-response";
import { totalForce } from "./forces";
import { rollOnWheels } from "./ground-roll";
import type { Plane } from "./plane";
import { TUNING } from "./tuning";
import { add, length, scale, type Vector3 } from "./vector";
import { wingStalled } from "./wing";

/** One fixed step of the flight model: the Plane `seconds` later, given the controls held. */
export function stepPlane(
  plane: Plane,
  controls: Controls,
  world: World,
  seconds: number,
): Plane {
  const throttle = nextThrottle(plane.throttle, controls, seconds);
  const flapsHeld = controls.has("flapsStep");
  const flaps =
    flapsHeld && !plane.flapsHeld ? nextFlapSetting(plane.flaps) : plane.flaps;
  const axes = bodyAxes(plane);
  const air = airflow(plane.velocity, axes);
  const stalled =
    !plane.onGround && wingStalled(air.angleOfAttack, plane.stalled);
  const force = totalForce(plane.velocity, axes, air, throttle, {
    flaps,
    stalled,
  });
  const rates = respondToControls(
    plane,
    controls,
    {
      air,
      pathPitchRate: pathPitchRate(plane.velocity, force),
      roll: plane.roll,
      onGround: plane.onGround,
      stalled,
    },
    seconds,
  );
  const attitude = turn(plane, rates, seconds);
  const velocity = plane.onGround
    ? rollOnWheels(
        plane.velocity,
        force,
        attitude.heading,
        controls.has("brakes"),
        seconds,
      )
    : add(plane.velocity, scale(force, seconds / TUNING.mass));
  const moved = add(plane.position, scale(velocity, seconds));
  const ground = world.groundHeight(moved.x, moved.y);
  // On the wheels it follows the ground until something lifts it; in the air it lands when it meets it.
  const onGround = plane.onGround ? velocity.z <= 0 : moved.z <= ground;
  const settled = onGround
    ? onTheGround(attitude, rates, velocity, moved, ground)
    : { ...attitude, ...rates, velocity, position: moved };
  return {
    ...holdInsideWorld(settled.position, settled.velocity, world),
    heading: settled.heading,
    pitch: settled.pitch,
    roll: settled.roll,
    rollRate: settled.rollRate,
    pitchRate: settled.pitchRate,
    yawRate: settled.yawRate,
    throttle,
    flaps,
    flapsHeld,
    brakes: controls.has("brakes"),
    stalled,
    onGround,
  };
}

/** How fast the force is bending the flight path up (positive) or down, in radians per second. */
function pathPitchRate(velocity: Vector3, force: Vector3): number {
  const speed = length(velocity);
  if (speed === 0) return 0;
  const level = Math.hypot(velocity.x, velocity.y);
  const forward =
    level === 0 ? 0 : (force.x * velocity.x + force.y * velocity.y) / level;
  // The force across the path in the vertical plane, over momentum.
  const across = (force.z * level - forward * velocity.z) / speed;
  return across / (TUNING.mass * speed);
}

function nextThrottle(
  throttle: number,
  controls: Controls,
  seconds: number,
): number {
  const direction = axis(controls, "throttleUp", "throttleDown");
  return Math.max(
    0,
    Math.min(1, throttle + direction * TUNING.throttleRate * seconds),
  );
}

/** The flap setting after `flaps`, going back up after the last one. */
function nextFlapSetting(flaps: number): number {
  const settings = TUNING.flapSettings;
  const index = settings.indexOf(flaps);
  return settings[(index + 1) % settings.length] ?? 0;
}

/** The wheels hold the Plane on the ground: wings level, no sinking, the nose between nosewheel and tail. */
function onTheGround(
  attitude: Attitude,
  rates: BodyRates,
  velocity: Vector3,
  position: Vector3,
  ground: number,
): Attitude & BodyRates & { velocity: Vector3; position: Vector3 } {
  const pitch = Math.max(0, Math.min(TUNING.maxGroundPitch, attitude.pitch));
  return {
    heading: attitude.heading,
    pitch,
    roll: 0,
    rollRate: 0,
    pitchRate: pitch === attitude.pitch ? rates.pitchRate : 0,
    yawRate: rates.yawRate,
    velocity: { ...velocity, z: 0 },
    position: { ...position, z: ground },
  };
}

/** The World's edge is a wall: the Plane stops at it and can only slide along it or turn away. */
function holdInsideWorld(
  position: Vector3,
  velocity: Vector3,
  world: World,
): { position: Vector3; velocity: Vector3 } {
  const limit = world.halfSize - TUNING.edgeMargin;
  const [x, velocityX] = holdOnAxis(position.x, velocity.x, limit);
  const [y, velocityY] = holdOnAxis(position.y, velocity.y, limit);
  return {
    position: { ...position, x, y },
    velocity: { ...velocity, x: velocityX, y: velocityY },
  };
}

function holdOnAxis(
  at: number,
  speed: number,
  limit: number,
): [number, number] {
  if (Math.abs(at) <= limit) return [at, speed];
  const side = Math.sign(at);
  return [side * limit, Math.sign(speed) === side ? 0 : speed];
}
