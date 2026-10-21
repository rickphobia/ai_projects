import { describe, expect, it } from "vitest";
import {
  FLOP_STEPS,
  WADDLE_STEPS,
  flop,
  waddle,
} from "../../../src/adapters/renderer/dude-motion";

describe("waddle", () => {
  it("is the same for the same Dude and step, so a replay looks the same", () => {
    expect(waddle(7, 120)).toEqual(waddle(7, 120));
  });

  it("repeats every waddle", () => {
    const now = waddle(3, 50);
    const later = waddle(3, 50 + WADDLE_STEPS);
    expect(later.tilt).toBeCloseTo(now.tilt);
    expect(later.bob).toBeCloseTo(now.bob);
  });

  it("puts neighbouring Dudes out of step", () => {
    expect(waddle(1, 0).tilt).not.toBeCloseTo(waddle(2, 0).tilt);
  });

  it("rocks both ways and never bobs below the ground", () => {
    const tilts = Array.from({ length: WADDLE_STEPS }, (_, step) =>
      waddle(0, step),
    );
    expect(Math.min(...tilts.map((w) => w.tilt))).toBeLessThan(0);
    expect(Math.max(...tilts.map((w) => w.tilt))).toBeGreaterThan(0);
    expect(Math.min(...tilts.map((w) => w.bob))).toBeGreaterThanOrEqual(0);
  });
});

describe("flop", () => {
  it("starts standing and fully seen", () => {
    expect(flop(0)).toEqual({ turn: 0, alpha: 1 });
  });

  it("lies over before it fades", () => {
    const mid = flop(FLOP_STEPS / 2);
    expect(mid?.turn).toBe(1);
    expect(mid?.alpha).toBeGreaterThan(0);
    expect(mid?.alpha).toBeLessThan(1);
  });

  it("is gone once its time is up", () => {
    expect(flop(FLOP_STEPS)).toBeNull();
  });
});
