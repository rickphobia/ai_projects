import { describe, expect, it } from "vitest";
import { sirenRing } from "../../../src/adapters/renderer/piece-motion";
import { STEPS_PER_SECOND } from "../../../src/battle/battle";
import { PIECES } from "../../../src/catalog/pieces";

const sirenStun = PIECES.siren.stun;
if (sirenStun === null) throw new Error("The Siren needs a stun.");
const stun = sirenStun;
const interval = Math.round(stun.intervalSeconds * STEPS_PER_SECOND);
const ring = (step: number, volume = 0) =>
  sirenRing(stun, step, STEPS_PER_SECOND, volume);

describe("sirenRing", () => {
  it("starts small and fully seen on the step the Siren pulses", () => {
    for (const step of [0, interval, 3 * interval]) {
      expect(ring(step).visible).toBe(true);
      expect(ring(step).alpha).toBe(1);
      expect(ring(step).scale).toBeLessThan(0.5);
    }
  });

  it("grows and fades after a pulse", () => {
    const early = ring(interval + 5);
    const later = ring(interval + 25);
    expect(later.scale).toBeGreaterThan(early.scale);
    expect(later.alpha).toBeLessThan(early.alpha);
    expect(later.scale).toBeLessThanOrEqual(1);
  });

  it("is hidden between pulses", () => {
    expect(ring(interval - 1).visible).toBe(false);
  });

  it("reaches further with Volume up and less far with it down", () => {
    const step = interval + 25;
    expect(ring(step, 2).scale).toBeGreaterThan(ring(step).scale);
    expect(ring(step, -2).scale).toBeLessThan(ring(step).scale);
  });
});
