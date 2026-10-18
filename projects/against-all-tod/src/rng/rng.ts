/** A seeded source of numbers in [0, 1). Every random roll goes through one, so a seed reproduces a Run. */
export type Rng = () => number;

/**
 * Mulberry32: small, fast and the same on every JavaScript engine, because it uses only
 * 32-bit integer maths. Not for anything secret.
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}
