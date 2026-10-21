import { describe, expect, it } from "vitest";
import { sirenRing } from "../../../src/adapters/renderer/piece-motion";
import { PIECES } from "../../../src/catalog/pieces";

const STEPS_PER_SECOND = 60;
const sirenStun = PIECES.siren.stun;
if (sirenStun === null) throw new Error("The Siren needs a stun.");
const stun = sirenStun;
const interval = stun.intervalSeconds * STEPS_PER_SECOND;

describe("sirenRing", () => {
  it("starts small and fully seen on the step the Siren pulses", () => {
    for (const step of [0, interval, 3 * interval]) {
      const ring = sirenRing(stun, step, STEPS_PER_SECOND);
      expect(ring.visible).toBe(true);
      expect(ring.alpha).toBe(1);
      expect(ring.scale).toBeLessThan(0.5);
    }
  });

  it("grows and fades after a pulse", () => {
    const early = sirenRing(stun, interval + 5, STEPS_PER_SECOND);
    const later = sirenRing(stun, interval + 25, STEPS_PER_SECOND);
    expect(later.scale).toBeGreaterThan(early.scale);
    expect(later.alpha).toBeLessThan(early.alpha);
    expect(later.scale).toBeLessThanOrEqual(1);
  });

  it("is hidden between pulses", () => {
    expect(sirenRing(stun, interval - 1, STEPS_PER_SECOND).visible).toBe(false);
  });
});
