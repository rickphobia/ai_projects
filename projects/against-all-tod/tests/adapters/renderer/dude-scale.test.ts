import { describe, expect, it } from "vitest";
import { dudeScale } from "../../../src/adapters/renderer/dude-scale";
import { DUDE_KINDS, type DudeKindId } from "../../../src/catalog/dudes";

describe("dudeScale", () => {
  it("draws the Landlord bigger than any other Dude, even a giant", () => {
    const landlord = dudeScale("landlord", false, false);
    for (const kind of Object.keys(DUDE_KINDS) as DudeKindId[]) {
      if (kind === "landlord") continue;
      expect(dudeScale(kind, true, false), kind).toBeLessThan(landlord);
    }
  });

  it("draws a giant bigger and a Split half smaller", () => {
    const plain = dudeScale("intern", false, false);
    expect(dudeScale("intern", true, false)).toBeGreaterThan(plain);
    expect(dudeScale("intern", false, true)).toBeLessThan(plain);
  });
});
