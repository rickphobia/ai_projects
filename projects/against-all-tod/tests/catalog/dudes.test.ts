import { describe, expect, it } from "vitest";
import {
  DUDE_KINDS,
  DUDE_KINDS_ON_SALE,
  paintRadius,
  type DudeKindId,
} from "../../src/catalog/dudes";
import { BOARD_ROWS, SPAWN_ZONE_COLUMNS } from "../../src/maze/board";

describe("the Dude kind catalog", () => {
  it("files every entry under its own id", () => {
    for (const [id, entry] of Object.entries(DUDE_KINDS)) {
      expect(entry.id).toBe(id as DudeKindId);
    }
  });

  it("prices every kind in whole gold per Dude, with a gift size and Giant's N", () => {
    for (const kind of Object.values(DUDE_KINDS)) {
      expect(Number.isInteger(kind.dudePrice)).toBe(true);
      expect(kind.dudePrice).toBeGreaterThan(0);
      expect(Number.isInteger(kind.giftSize)).toBe(true);
      expect(kind.giftSize).toBeGreaterThan(0);
      expect(Number.isInteger(kind.giantEvery)).toBe(true);
      expect(kind.giantEvery).toBeGreaterThan(0);
    }
  });

  it("sells the kinds a Run starts with, not the ones Unlocks will add", () => {
    expect(DUDE_KINDS_ON_SALE).toContain("intern");
    for (const id of DUDE_KINDS_ON_SALE) {
      expect(DUDE_KINDS[id].unlockScore).toBeNull();
    }
  });

  it("gives a bigger kind room in proportion to its size", () => {
    const ramCrew = paintRadius("ram-crew") ** 2;
    const intern = paintRadius("intern") ** 2;
    expect(ramCrew / intern).toBeCloseTo(DUDE_KINDS["ram-crew"].size, 5);
  });

  it("fits about 500 Interns in a full Spawn zone", () => {
    // Packed as tightly as circles go: rows half a spacing apart sideways.
    const spacing = 2 * paintRadius("intern");
    const rowGap = (spacing * Math.sqrt(3)) / 2;
    let count = 0;
    for (let row = 0; row * rowGap < BOARD_ROWS; row++) {
      const offset = row % 2 === 0 ? 0 : spacing / 2;
      for (let x = offset; x < SPAWN_ZONE_COLUMNS; x += spacing) count++;
    }
    expect(count).toBeGreaterThanOrEqual(450);
    expect(count).toBeLessThanOrEqual(550);
  });
});
