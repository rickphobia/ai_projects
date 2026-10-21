import { Texture, type Graphics } from "pixi.js";
import { describe, expect, it } from "vitest";
import {
  DUDE_FRAME,
  drawDudeTextures,
} from "../../../src/adapters/renderer/dude-art";
import { DUDE_KINDS, type DudeKindId } from "../../../src/catalog/dudes";

/** Stands in for the renderer: each bake makes its own texture and keeps what was drawn. */
function fakeBake() {
  const baked: { shape: Graphics; width: number; height: number }[] = [];
  const bake = (shape: Graphics, width: number, height: number): Texture => {
    baked.push({ shape, width, height });
    return new Texture();
  };
  return { bake, baked };
}

describe("drawDudeTextures", () => {
  it("has a calm and a panicked look for every Dude kind in the catalog", () => {
    const { dudes } = drawDudeTextures(fakeBake().bake);
    for (const kind of Object.keys(DUDE_KINDS) as DudeKindId[]) {
      expect(dudes[kind].calm, kind).toBeInstanceOf(Texture);
      expect(dudes[kind].panicked, kind).not.toBe(dudes[kind].calm);
    }
  });

  it("gives every Dude kind its own silhouette", () => {
    const { dudes } = drawDudeTextures(fakeBake().bake);
    const drawn = Object.values(dudes).map(({ calm }) => calm);
    expect(drawn).toHaveLength(Object.keys(DUDE_KINDS).length);
    expect(new Set(drawn).size).toBe(drawn.length);
  });

  it("has a gold grin for every kind and a mark for Explosive Shields and Conga Line", () => {
    const textures = drawDudeTextures(fakeBake().bake);
    const grins = Object.values(textures.dudes).map(({ goldGrin }) => goldGrin);
    expect(new Set(grins).size).toBe(grins.length);
    expect(textures.fuse).toBeInstanceOf(Texture);
    expect(textures.congaHands).toBeInstanceOf(Texture);
    expect(textures.fuse).not.toBe(textures.congaHands);
  });

  it("draws every Dude inside its frame", () => {
    const { bake, baked } = fakeBake();
    drawDudeTextures(bake);
    for (const { shape, width, height } of baked) {
      const { minX, minY, maxX, maxY } = shape.bounds;
      expect([width, height]).toEqual([DUDE_FRAME, DUDE_FRAME]);
      expect(minX).toBeGreaterThanOrEqual(0);
      expect(minY).toBeGreaterThanOrEqual(0);
      expect(maxX).toBeLessThanOrEqual(DUDE_FRAME);
      expect(maxY).toBeLessThanOrEqual(DUDE_FRAME);
    }
  });
});
