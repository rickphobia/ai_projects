import { TUNING } from "./tuning";
import { dot, length, type Vector3 } from "./vector";

export interface Attitude {
  readonly heading: number;
  readonly pitch: number;
  readonly roll: number;
}

/** The Plane's own axes in the World: where the nose, the right wing and the cabin roof point. */
export interface BodyAxes {
  readonly forward: Vector3;
  readonly right: Vector3;
  readonly up: Vector3;
}

export function bodyAxes({ heading, pitch, roll }: Attitude): BodyAxes {
  const sinHeading = Math.sin(heading);
  const cosHeading = Math.cos(heading);
  const sinPitch = Math.sin(pitch);
  const cosPitch = Math.cos(pitch);
  const sinRoll = Math.sin(roll);
  const cosRoll = Math.cos(roll);
  // The right wing and roof before rolling; rolling turns them about the nose.
  const levelRight = { x: cosHeading, y: -sinHeading, z: 0 };
  const levelUp = {
    x: -sinHeading * sinPitch,
    y: -cosHeading * sinPitch,
    z: cosPitch,
  };
  return {
    forward: {
      x: sinHeading * cosPitch,
      y: cosHeading * cosPitch,
      z: sinPitch,
    },
    right: {
      x: levelRight.x * cosRoll - levelUp.x * sinRoll,
      y: levelRight.y * cosRoll - levelUp.y * sinRoll,
      z: -levelUp.z * sinRoll,
    },
    up: {
      x: levelUp.x * cosRoll + levelRight.x * sinRoll,
      y: levelUp.y * cosRoll + levelRight.y * sinRoll,
      z: levelUp.z * cosRoll,
    },
  };
}

/** How the air meets the Plane. With no wind, the airflow is just the Plane's own velocity. */
export interface Airflow {
  readonly speed: number;
  /** How far the nose is above the airflow. */
  readonly angleOfAttack: number;
  /** How far the airflow comes from the right of the nose. */
  readonly sideslip: number;
}

export function airflow(velocity: Vector3, axes: BodyAxes): Airflow {
  const along = dot(velocity, axes.forward);
  return {
    speed: length(velocity),
    angleOfAttack: Math.atan2(-dot(velocity, axes.up), along),
    sideslip: Math.atan2(dot(velocity, axes.right), along),
  };
}

export interface BodyRates {
  readonly rollRate: number;
  readonly pitchRate: number;
  readonly yawRate: number;
}

/** Turns the Plane by its body rates for one step. */
export function turn(
  attitude: Attitude,
  rates: BodyRates,
  seconds: number,
): Attitude {
  const { heading, pitch, roll } = attitude;
  const { rollRate, pitchRate, yawRate } = rates;
  // Body rates to heading, pitch and roll rates: the standard aircraft Euler-angle relations.
  const aroundRoof = pitchRate * Math.sin(roll) + yawRate * Math.cos(roll);
  const headingRate = aroundRoof / Math.cos(pitch);
  const pitchChange = pitchRate * Math.cos(roll) - yawRate * Math.sin(roll);
  const rollChange = rollRate + aroundRoof * Math.tan(pitch);
  return {
    heading: wrapTurn(heading + headingRate * seconds),
    pitch: Math.max(
      -TUNING.maxPitch,
      Math.min(TUNING.maxPitch, pitch + pitchChange * seconds),
    ),
    roll: wrapHalfTurn(roll + rollChange * seconds),
  };
}

/** An angle in [0, 2π). */
export function wrapTurn(angle: number): number {
  const turns = angle / (2 * Math.PI);
  return (turns - Math.floor(turns)) * 2 * Math.PI;
}

/** An angle in (-π, π]. */
function wrapHalfTurn(angle: number): number {
  const wrapped = wrapTurn(angle);
  return wrapped > Math.PI ? wrapped - 2 * Math.PI : wrapped;
}
