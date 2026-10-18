import { Texture } from "pixi.js";
import grassUrl from "../../../assets/kenney-tower-defense-top-down/towerDefense_tile024.png";
import crateWallUrl from "../../../assets/kenney-tower-defense-top-down/towerDefense_tile063.png";
import dirtUrl from "../../../assets/kenney-tower-defense-top-down/towerDefense_tile158.png";
import towerBaseUrl from "../../../assets/kenney-tower-defense-top-down/towerDefense_tile181.png";
import stoneBaseUrl from "../../../assets/kenney-tower-defense-top-down/towerDefense_tile182.png";
import turretUrl from "../../../assets/kenney-tower-defense-top-down/towerDefense_tile203.png";
import dudeUrl from "../../../assets/kenney-tower-defense-top-down/towerDefense_tile248.png";

/** Kenney's Tower Defense (top-down) tiles are 64 px square; one tile per Board tile. */
export const TILE_SIZE = 64;

export interface BoardTextures {
  /** Open ground. */
  readonly grass: Texture;
  /** The Spawn line. */
  readonly dirt: Texture;
  /** Under the Goal. */
  readonly stoneBase: Texture;
  /** The Crate Wall Piece. */
  readonly crateWall: Texture;
  /** Under a tower Piece. */
  readonly towerBase: Texture;
  /** A grey turret, barrels pointing up, tinted in the defense colour. */
  readonly turret: Texture;
  /** A grey soldier seen from above, facing up, drawn on a disc in the attack colour. */
  readonly dude: Texture;
}

export class TextureLoadError extends Error {
  override name = "TextureLoadError";
}

/** Single tiles rather than the pack's tilesheet: its frames have no padding, so scaled tiles bleed their neighbours. */
export async function loadBoardTextures(): Promise<BoardTextures> {
  const [grass, dirt, stoneBase, crateWall, towerBase, turret, dude] =
    await Promise.all([
      loadTexture("grass", grassUrl),
      loadTexture("dirt", dirtUrl),
      loadTexture("stone base", stoneBaseUrl),
      loadTexture("crate wall", crateWallUrl),
      loadTexture("tower base", towerBaseUrl),
      loadTexture("turret", turretUrl),
      loadTexture("dude", dudeUrl),
    ]);
  return { grass, dirt, stoneBase, crateWall, towerBase, turret, dude };
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
