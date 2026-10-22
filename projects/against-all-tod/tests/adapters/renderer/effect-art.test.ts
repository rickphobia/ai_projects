import { Texture, type Graphics } from "pixi.js";
import { describe, expect, it } from "vitest";
import { drawEffectTextures } from "../../../src/adapters/renderer/effect-art";

/** Stands in for the renderer: each bake makes its own texture and keeps what was drawn. */
function fakeBake() {
  const baked: { shape: Graphics; width: number; height: number }[] = [];
  const bake = (shape: Graphics, width: number, height: number): Texture => {
    baked.push({ shape, width, height });
    return new Texture();
  };
  return { bake, baked };
}

describe("drawEffectTextures", () => {
  it("draws each effect once, each its own texture", () => {
    const textures = drawEffectTextures(fakeBake().bake);
    const all = Object.values(textures);
    for (const texture of all) expect(texture).toBeInstanceOf(Texture);
    expect(new Set(all).size).toBe(all.length);
  });

  it("draws everything inside its frame", () => {
    const { bake, baked } = fakeBake();
    drawEffectTextures(bake);
    for (const { shape, width, height } of baked) {
      const { minX, minY, maxX, maxY } = shape.bounds;
      expect(minX).toBeGreaterThanOrEqual(0);
      expect(minY).toBeGreaterThanOrEqual(0);
      expect(maxX).toBeLessThanOrEqual(width);
      expect(maxY).toBeLessThanOrEqual(height);
    }
  });
});
