import { Graphics } from "pixi.js";
import {
  ATTACK_COLOUR,
  EYE_COLOUR,
  OUTLINE_COLOUR,
  SHADOW_ALPHA,
  SHADOW_COLOUR,
} from "./board-view";

/** The pieces every Dude drawing is built from, so all kinds share one style. */

/** Every Dude is drawn in a square this many px wide, centred on the Dude's point. */
export const DUDE_FRAME = 48;
/** A blob's outline: a touch thinner than the Board's, as Dudes are drawn small. */
export const DUDE_OUTLINE = 2.5;
export const LEG_WIDTH = 2;
export const HIGHLIGHT_ALPHA = 0.35;

export type Face = "calm" | "panicked";

/** Drawn first, so everything stands on it: a flat oval at (x, y) half `halfWidth` wide. */
export function shadow(x: number, y: number, halfWidth: number): Graphics {
  return new Graphics()
    .ellipse(x, y, halfWidth, halfWidth * 0.3)
    .fill({ color: SHADOW_COLOUR, alpha: SHADOW_ALPHA });
}

/** A body or head in the attack colour with the dark outline. */
export function blob(
  shape: Graphics,
  x: number,
  y: number,
  halfWidth: number,
  halfHeight: number,
): void {
  shape
    .ellipse(x, y, halfWidth, halfHeight)
    .fill(ATTACK_COLOUR)
    .stroke({ color: OUTLINE_COLOUR, width: DUDE_OUTLINE });
}

/**
 * Two dot eyes centred on (x, y), looking ahead (right, toward the Goal). Panicked, they open
 * wide with tiny pupils over an O of a mouth.
 */
export function eyes(
  shape: Graphics,
  x: number,
  y: number,
  radius: number,
  face: Face,
): void {
  const apart = radius * 1.15;
  const panicked = face === "panicked";
  const white = panicked ? radius * 1.3 : radius;
  const pupil = panicked ? radius * 0.35 : radius * 0.55;
  const look = panicked ? 0 : radius * 0.3;
  for (const eyeX of [x - apart, x + apart]) {
    shape
      .circle(eyeX, y, white)
      .fill(EYE_COLOUR)
      .stroke({ color: OUTLINE_COLOUR, width: 1 })
      .circle(eyeX + look, y, pupil)
      .fill(OUTLINE_COLOUR);
  }
  if (panicked) {
    shape
      .ellipse(x, y + white + radius * 0.7, radius * 0.45, radius * 0.6)
      .fill(OUTLINE_COLOUR);
  }
}
