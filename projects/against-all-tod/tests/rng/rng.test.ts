import { describe, expect, it } from "vitest";
import { createRng } from "../../src/rng/rng";

function rolls(seed: number, count: number): number[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => rng());
}

describe("createRng", () => {
  it("gives the same rolls for the same seed", () => {
    expect(rolls(42, 50)).toEqual(rolls(42, 50));
  });

  it("gives different rolls for different seeds", () => {
    expect(rolls(1, 10)).not.toEqual(rolls(2, 10));
  });

  it("rolls numbers from 0 up to but not including 1", () => {
    for (const roll of rolls(7, 1000)) {
      expect(roll).toBeGreaterThanOrEqual(0);
      expect(roll).toBeLessThan(1);
    }
  });

  it("accepts the largest seed the config allows", () => {
    expect(rolls(2 ** 32 - 1, 5)).toHaveLength(5);
  });
});
