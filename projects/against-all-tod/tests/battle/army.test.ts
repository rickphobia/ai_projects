import { describe, expect, it } from "vitest";
import {
  giantsOf,
  hasRoom,
  isSpawnZonePoint,
  nextStroke,
  roundOneArmy,
  type PlacedDude,
} from "../../src/battle/army";
import {
  DUDE_KINDS,
  paintRadius,
  ROUND_ONE_ARMY,
  type DudeKindId,
} from "../../src/catalog/dudes";
import { SPAWN_ZONE_COLUMNS } from "../../src/maze/board";

function placed(
  dudeKind: DudeKindId,
  x: number,
  y: number,
  stroke = 0,
): PlacedDude {
  return { dudeKind, at: { x, y }, stroke, round: 2 };
}

describe("the Spawn zone as points", () => {
  it("holds points inside the 3 left columns and nowhere else", () => {
    expect(isSpawnZonePoint({ x: 0, y: 0 })).toBe(true);
    expect(isSpawnZonePoint({ x: 2.99, y: 13.99 })).toBe(true);
    expect(isSpawnZonePoint({ x: SPAWN_ZONE_COLUMNS, y: 5 })).toBe(false);
    expect(isSpawnZonePoint({ x: -0.01, y: 5 })).toBe(false);
    expect(isSpawnZonePoint({ x: 1, y: 14 })).toBe(false);
  });
});

describe("room around a Dude", () => {
  const spacing = 2 * paintRadius("intern");

  it("refuses a Dude closer to another than their two radii", () => {
    const army = [placed("intern", 1, 1)];
    expect(hasRoom(army, "intern", { x: 1 + spacing * 0.9, y: 1 })).toBe(false);
    expect(hasRoom(army, "intern", { x: 1 + spacing + 1e-9, y: 1 })).toBe(true);
  });

  it("keeps more room around a bigger kind", () => {
    const army = [placed("ram-crew", 1, 1)];
    const apart = paintRadius("ram-crew") + paintRadius("intern");
    expect(hasRoom(army, "intern", { x: 1, y: 1 + spacing })).toBe(false);
    expect(hasRoom(army, "intern", { x: 1, y: 1 + apart + 1e-9 })).toBe(true);
  });
});

describe("Strokes", () => {
  it("numbers a new Stroke one past the highest so far", () => {
    expect(nextStroke([])).toBe(0);
    expect(
      nextStroke([placed("intern", 0.5, 0.5, 4), placed("intern", 1, 1, 2)]),
    ).toBe(5);
  });
});

describe("Giant's choice", () => {
  it("picks every Nth Dude of each kind in paint order, counting kinds apart", () => {
    const army = Array.from({ length: 45 }, (_, index) =>
      placed(index % 3 === 0 ? "shield-bro" : "intern", 0.5, 0.5),
    );
    const giants = giantsOf(army);
    const counts = new Map<DudeKindId, number>();
    for (const [index, dude] of army.entries()) {
      const count = (counts.get(dude.dudeKind) ?? 0) + 1;
      counts.set(dude.dudeKind, count);
      expect(giants[index]).toBe(
        count % DUDE_KINDS[dude.dudeKind].giantEvery === 0,
      );
    }
    expect(giants.filter(Boolean)).toHaveLength(
      Math.floor(30 / DUDE_KINDS.intern.giantEvery) +
        Math.floor(15 / DUDE_KINDS["shield-bro"].giantEvery),
    );
  });

  it("makes every Ram Crew giant", () => {
    expect(DUDE_KINDS["ram-crew"].giantEvery).toBe(1);
    expect(giantsOf([placed("ram-crew", 1, 1)])).toEqual([true]);
  });
});

describe("the Round 1 Army", () => {
  const army = roundOneArmy(7);

  it("lays out each blob of Interns as a Stroke, all in the Spawn zone with room to spare", () => {
    expect(army).toHaveLength(
      ROUND_ONE_ARMY.dudesPerBlob * ROUND_ONE_ARMY.blobCentres.length,
    );
    expect(new Set(army.map((dude) => dude.stroke)).size).toBe(
      ROUND_ONE_ARMY.blobCentres.length,
    );
    for (const [index, dude] of army.entries()) {
      expect(dude.dudeKind).toBe("intern");
      expect(isSpawnZonePoint(dude.at)).toBe(true);
      const others = army.filter((_, other) => other !== index);
      expect(hasRoom(others, dude.dudeKind, dude.at)).toBe(true);
    }
  });

  it("is the same from the same seed and differs with another", () => {
    expect(roundOneArmy(7)).toEqual(army);
    expect(roundOneArmy(8)).not.toEqual(army);
  });
});
