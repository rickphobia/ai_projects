import { Texture, type Graphics } from "pixi.js";
import { describe, expect, it } from "vitest";
import { drawPieceTextures } from "../../../src/adapters/renderer/piece-art";
import { PIECES, type PieceId } from "../../../src/catalog/pieces";

/** Stands in for the renderer: each bake makes its own texture and keeps what was drawn. */
function fakeBake() {
  const baked: { shape: Graphics; width: number; height: number }[] = [];
  const bake = (shape: Graphics, width: number, height: number): Texture => {
    baked.push({ shape, width, height });
    return new Texture();
  };
  return { bake, baked };
}

describe("drawPieceTextures", () => {
  it("has its own drawing for every Piece in the catalog", () => {
    const { pieces } = drawPieceTextures(fakeBake().bake);
    const ids = Object.keys(PIECES) as PieceId[];
    for (const id of ids) expect(pieces[id], id).toBeInstanceOf(Texture);
    expect(new Set(ids.map((id) => pieces[id])).size).toBe(ids.length);
  });

  it("draws each moving part apart from the bodies", () => {
    const textures = drawPieceTextures(fakeBake().bake);
    const parts = [
      textures.sniperBarrel,
      textures.turnstileArms,
      textures.lighthouseCone,
      textures.sirenRing,
      textures.grinderTeeth,
    ];
    const bodies = new Set(Object.values(textures.pieces));
    for (const part of parts) expect(bodies.has(part)).toBe(false);
    expect(new Set(parts).size).toBe(parts.length);
  });

  it("draws everything inside its frame", () => {
    const { bake, baked } = fakeBake();
    drawPieceTextures(bake);
    for (const { shape, width, height } of baked) {
      const { minX, minY, maxX, maxY } = shape.bounds;
      expect(minX).toBeGreaterThanOrEqual(0);
      expect(minY).toBeGreaterThanOrEqual(0);
      expect(maxX).toBeLessThanOrEqual(width);
      expect(maxY).toBeLessThanOrEqual(height);
    }
  });
});
