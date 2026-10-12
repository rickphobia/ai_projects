import type { World } from "./world";

/** Where the pilot's eye is and which way it looks. Angles are radians. */
export interface CameraPose {
  /** Metres east and north, as in the World. */
  x: number;
  y: number;
  /** Metres above the World's base height. */
  height: number;
  /** Clockwise from north. */
  heading: number;
  /** Nose up is positive. */
  pitch: number;
  /** Right wing down is positive. */
  roll: number;
}

/** A Cessna 172 pilot's eye is about this high above the ground when parked. */
const EYE_HEIGHT = 2;
/** The Plane waits this far in from the Runway's start, so it isn't parked on the grass. */
const DISTANCE_FROM_START = 60;

/** The camera of a Plane parked at the start of the Runway, ready to roll. */
export function cockpitCameraOnRunway(world: World): CameraPose {
  const { runway } = world;
  const back = runway.length / 2 - DISTANCE_FROM_START;
  const x = runway.x - back * Math.sin(runway.heading);
  const y = runway.y - back * Math.cos(runway.heading);
  return {
    x,
    y,
    height: world.groundHeight(x, y) + EYE_HEIGHT,
    heading: runway.heading,
    pitch: 0,
    roll: 0,
  };
}
