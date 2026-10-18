import { describe, expect, it } from "vitest";
import { PIECES, type PieceId } from "../../src/catalog/pieces";

describe("the Piece catalog", () => {
  it("files every entry under its own id", () => {
    for (const [id, entry] of Object.entries(PIECES)) {
      expect(entry.id).toBe(id as PieceId);
    }
  });

  it("has a Crate Wall that blocks Dudes and has a price and health", () => {
    const crateWall = PIECES["crate-wall"];
    expect(crateWall.name).toBe("Crate Wall");
    expect(crateWall.blocksDudes).toBe(true);
    expect(crateWall.price).toBeGreaterThan(0);
    expect(crateWall.health).toBeGreaterThan(0);
    expect(crateWall.tower).toBeNull();
  });

  it("has a Sniper Nest that blocks Dudes and shoots", () => {
    const sniperNest = PIECES["sniper-nest"];
    expect(sniperNest.blocksDudes).toBe(true);
    expect(sniperNest.tower?.range).toBeGreaterThan(0);
    expect(sniperNest.tower?.damage).toBeGreaterThan(0);
    expect(sniperNest.tower?.fireIntervalSeconds).toBeGreaterThan(0);
  });
});
