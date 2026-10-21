import { Graphics } from "pixi.js";
import { TILE_SIZE } from "./board-textures";
import {
  OUTLINE_COLOUR,
  OUTLINE_WIDTH,
  SHADOW_ALPHA,
  SHADOW_COLOUR,
  SHADOW_OFFSET,
} from "./board-view";

/** Thin inner lines: planks, bars, bolts. */
export const DETAIL_WIDTH = 2;
export const DETAIL_ALPHA = 0.35;
export const TILE_MIDDLE = TILE_SIZE / 2;

/** The outline as a stroke style, so every Piece strokes alike. */
export const outline = (width = OUTLINE_WIDTH) =>
  ({ color: OUTLINE_COLOUR, width, join: "round", cap: "round" }) as const;

/** A soft rounded shadow under a standing Piece's footprint; floor Pieces lie flat without one. */
export function shadow(
  left: number,
  top: number,
  width: number,
  height: number,
  radius: number,
): Graphics {
  return new Graphics()
    .roundRect(left + SHADOW_OFFSET, top + SHADOW_OFFSET, width, height, radius)
    .fill({ color: SHADOW_COLOUR, alpha: SHADOW_ALPHA });
}
