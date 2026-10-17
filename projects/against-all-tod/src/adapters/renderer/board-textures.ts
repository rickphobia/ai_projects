import { Assets, type Texture } from "pixi.js";
import grassUrl from "../../../assets/kenney-tower-defense-top-down/towerDefense_tile024.png";
import dirtUrl from "../../../assets/kenney-tower-defense-top-down/towerDefense_tile158.png";
import stoneBaseUrl from "../../../assets/kenney-tower-defense-top-down/towerDefense_tile182.png";

/** Kenney's Tower Defense (top-down) tiles are 64 px square; one tile per Board tile. */
export const TILE_SIZE = 64;

export interface BoardTextures {
  /** Open ground. */
  readonly grass: Texture;
  /** The Spawn line. */
  readonly dirt: Texture;
  /** Under the Goal. */
  readonly stoneBase: Texture;
}

/** Single tiles rather than the pack's tilesheet: its frames have no padding, so scaled tiles bleed their neighbours. */
export async function loadBoardTextures(): Promise<BoardTextures> {
  const [grass, dirt, stoneBase] = await Promise.all([
    Assets.load<Texture>(grassUrl),
    Assets.load<Texture>(dirtUrl),
    Assets.load<Texture>(stoneBaseUrl),
  ]);
  return { grass, dirt, stoneBase };
}
