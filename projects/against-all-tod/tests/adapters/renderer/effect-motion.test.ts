import { describe, expect, it } from "vitest";
import {
  BULLET_MS,
  BURST_MS,
  GOLD_POP_MS,
  bulletProgress,
  burstPose,
  goldPose,
} from "../../../src/adapters/renderer/effect-motion";

describe("effect timing", () => {
  it("keeps ordinary effects to about a fifth of a second", () => {
    expect(BURST_MS).toBeLessThanOrEqual(250);
    // A shot's bullet and the puff it lands as, together.
    expect(BULLET_MS + BURST_MS).toBeLessThanOrEqual(350);
  });

  it("flies a bullet from 0 to 1, then it has landed", () => {
    expect(bulletProgress(0)).toBe(0);
    expect(bulletProgress(BULLET_MS / 2)).toBeCloseTo(0.5);
    expect(bulletProgress(BULLET_MS)).toBeNull();
  });

  it("pops a burst out, then fades it to nothing", () => {
    const start = burstPose(0);
    const peak = burstPose(BURST_MS * 0.35);
    const late = burstPose(BURST_MS * 0.95);
    expect(start?.alpha).toBe(1);
    expect(peak?.scale).toBeGreaterThan(start?.scale ?? Infinity);
    expect(late?.alpha).toBeLessThan(0.1);
    expect(burstPose(BURST_MS)).toBeNull();
  });

  it("raises a gold pop and fades it over its second half", () => {
    expect(goldPose(0)).toEqual({ rise: 0, alpha: 1 });
    const half = goldPose(GOLD_POP_MS / 2);
    expect(half?.alpha).toBe(1);
    expect(half?.rise).toBeGreaterThan(0);
    expect(goldPose(GOLD_POP_MS * 0.9)?.alpha).toBeLessThan(0.25);
    expect(goldPose(GOLD_POP_MS)).toBeNull();
  });
});
