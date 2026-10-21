import type { Plane } from "./plane";
import { TUNING } from "./tuning";

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

/** The pilot's eye in the Plane, looking where the nose points. */
export function cockpitCamera(plane: Plane): CameraPose {
  return {
    x: plane.position.x,
    y: plane.position.y,
    height: plane.position.z + TUNING.eyeHeight,
    heading: plane.heading,
    pitch: plane.pitch,
    roll: plane.roll,
  };
}
