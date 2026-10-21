import { Texture } from "pixi.js";
import towerBaseUrl from "../../../assets/kenney-tower-defense-top-down/towerDefense_tile181.png";
import turretUrl from "../../../assets/kenney-tower-defense-top-down/towerDefense_tile203.png";
import dudeUrl from "../../../assets/kenney-tower-defense-top-down/towerDefense_tile248.png";
import type { ArtTextures } from "./art-kit";

/** A Board tile is 64 px square, the size of Kenney's Tower Defense (top-down) tiles. */
export const TILE_SIZE = 64;

/** Kenney tiles still in use until their art tickets draw them in code too (decision 0005). */
export interface KenneyTextures {
  /** Under a tower Piece. */
  readonly towerBase: Texture;
  /** A grey turret, barrels pointing up, tinted in the defense colour. */
  readonly turret: Texture;
  /** A grey soldier seen from above, facing up, drawn on a disc in the attack colour. */
  readonly dude: Texture;
}

/** Everything the views draw with: the art kit's drawn shapes and the Kenney tiles left. */
export type BoardTextures = KenneyTextures & ArtTextures;

export class TextureLoadError extends Error {
  override name = "TextureLoadError";
}

/** Single tiles rather than the pack's tilesheet: its frames have no padding, so scaled tiles bleed their neighbours. */
export async function loadKenneyTextures(): Promise<KenneyTextures> {
  const [towerBase, turret, dude] = await Promise.all([
    loadTexture("tower base", towerBaseUrl),
    loadTexture("turret", turretUrl),
    loadTexture("dude", dudeUrl),
  ]);
  return { towerBase, turret, dude };
}

/**
 * Loads through an <img>, not PixiJS's Assets loader: Vite inlines small images as data: URLs,
 * and the loader fetch()es them, which a sandbox like the Artifact preview's blocks (connect-src)
 * while still allowing them as images.
 */
async function loadTexture(name: string, url: string): Promise<Texture> {
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch (error) {
    throw new TextureLoadError(`Could not load the ${name} tile.`, {
      cause: error,
    });
  }
  return Texture.from(image);
}
