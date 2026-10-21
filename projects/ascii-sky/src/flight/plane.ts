import type { World } from "../world/world";
import { TUNING } from "./tuning";
import { type Vector3, ZERO } from "./vector";

/**
 * Everything the flight model knows about the Plane at one moment. Angles are radians, in the
 * usual aircraft sense: heading clockwise from north, nose up positive, right wing down positive.
 */
export interface Plane {
  /** Where the wheels are: metres east and north, and height above the World's base height. */
  readonly position: Vector3;
  /** Metres per second, in the World's axes. */
  readonly velocity: Vector3;
  readonly heading: number;
  readonly pitch: number;
  readonly roll: number;
  /** Turning rates about the Plane's own axes, radians per second. */
  readonly rollRate: number;
  readonly pitchRate: number;
  readonly yawRate: number;
  /** 0 is idle, 1 is full. */
  readonly throttle: number;
  /** Flap deflection, one of the tuned flap settings. */
  readonly flaps: number;
  /** Whether F was held last step, so holding it moves the flaps one setting, not one every step. */
  readonly flapsHeld: boolean;
  readonly brakes: boolean;
  /** Set while the wing is past its critical angle of attack in the air. */
  readonly stalled: boolean;
  readonly onGround: boolean;
}

/** A Plane standing still at idle at the start of the Runway, pointing down it. */
export function planeOnRunway(world: World): Plane {
  const { runway } = world;
  const back = runway.length / 2 - TUNING.startDistance;
  const x = runway.x - back * Math.sin(runway.heading);
  const y = runway.y - back * Math.cos(runway.heading);
  return {
    position: { x, y, z: world.groundHeight(x, y) },
    velocity: ZERO,
    heading: runway.heading,
    pitch: 0,
    roll: 0,
    rollRate: 0,
    pitchRate: 0,
    yawRate: 0,
    throttle: 0,
    flaps: 0,
    flapsHeld: false,
    brakes: false,
    stalled: false,
    onGround: true,
  };
}
