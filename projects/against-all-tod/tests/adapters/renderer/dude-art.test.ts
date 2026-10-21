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

  it("gives the first five kinds their own silhouettes", () => {
    const { dudes } = drawDudeTextures(fakeBake().bake);
    const drawn = (
      ["intern", "termite", "ram-crew", "balloonist", "shield-bro"] as const
    ).map((kind) => dudes[kind].calm);
    expect(new Set(drawn).size).toBe(drawn.length);
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
