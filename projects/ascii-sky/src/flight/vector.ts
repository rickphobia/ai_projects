/** A direction or amount in the World: `x` east, `y` north, `z` up. */
export interface Vector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const ZERO: Vector3 = { x: 0, y: 0, z: 0 };

export function add(...vectors: readonly Vector3[]): Vector3 {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const vector of vectors) {
    x += vector.x;
    y += vector.y;
    z += vector.z;
  }
  return { x, y, z };
}

export function scale(vector: Vector3, factor: number): Vector3 {
  return { x: vector.x * factor, y: vector.y * factor, z: vector.z * factor };
}

export function dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function length(vector: Vector3): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

/** The vector scaled to length 1, or zero if it has no length to scale. */
export function normalize(vector: Vector3): Vector3 {
  const size = length(vector);
  return size === 0 ? ZERO : scale(vector, 1 / size);
}
