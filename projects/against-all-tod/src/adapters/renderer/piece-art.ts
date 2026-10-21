import { Graphics, type Texture } from "pixi.js";
import { PIECES, type PieceId } from "../../catalog/pieces";
import { TILE_SIZE } from "./board-textures";
import {
  DEFENSE_COLOUR,
  METAL_COLOUR,
  OUTLINE_COLOUR,
  WOOD_COLOUR,
} from "./board-view";
import type { Bake } from "./dude-art";
import {
  DETAIL_ALPHA,
  DETAIL_WIDTH,
  TILE_MIDDLE,
  outline,
  shadow,
} from "./piece-parts";
import {
  bouncer,
  decoyGoal,
  grinderPlate,
  grinderTeeth,
  taxBooth,
} from "./trap-art";
import {
  hrDepartment,
  lightCone,
  lighthouse,
  sandbags,
  siren,
  sirenRing,
  sniperBarrel,
} from "./tower-art";

/**
 * Every Piece's drawing, baked once. A Piece is its still body in a tile-sized frame, plus, for
 * the Pieces with a working part that moves, that part on its own so the battle view can turn or
 * pulse it by sprite transforms (decision 0005) instead of redrawing.
 */
export interface PieceTextures {
  /** Each Piece's still body, a tile square from its top left. */
  readonly pieces: Readonly<Record<PieceId, Texture>>;
  /** The Sniper Nest's gun, a tile square, its barrel pointing right from the middle. */
  readonly sniperBarrel: Texture;
  /** The Turnstile's two gate arms, three tiles wide and one high, pointing left and right from the middle. */
  readonly turnstileArms: Texture;
  /** The Lighthouse's beam as long as its range, from the middle of its left edge pointing right. */
  readonly lighthouseCone: Texture;
  /** One Siren ring as wide as its stun reaches at neutral Volume. */
  readonly sirenRing: Texture;
  /** The Grinder's cog, a tile square, centred. */
  readonly grinderTeeth: Texture;
}

export class PieceArtError extends Error {
  override name = "PieceArtError";
}

/** Every Piece's body. A Record, so a new Piece in the catalog fails to compile until drawn. */
const DRAWINGS: Readonly<Record<PieceId, () => Graphics>> = {
  "crate-wall": crateStack,
  "sniper-nest": sandbags,
  turnstile: turnstilePost,
  lighthouse,
  siren,
  "tax-booth": taxBooth,
  grinder: grinderPlate,
  bouncer,
  "decoy-goal": decoyGoal,
  "hr-department": hrDepartment,
};

export function drawPieceTextures(bake: Bake): PieceTextures {
  const tile = (shape: Graphics): Texture => bake(shape, TILE_SIZE, TILE_SIZE);
  const pieces = Object.fromEntries(
    Object.values(PIECES).map(({ id }) => [id, tile(DRAWINGS[id]())]),
  ) as Record<PieceId, Texture>;
  const beam = PIECES.lighthouse.beam;
  const stun = PIECES.siren.stun;
  if (beam === null || stun === null) {
    throw new PieceArtError(
      "The Lighthouse needs a beam and the Siren a stun to draw them.",
    );
  }
  const coneLength = beam.range * TILE_SIZE;
  const coneHalfHeight =
    coneLength * Math.tan((beam.halfWidthDegrees * Math.PI) / 180);
  const ringDiameter = 2 * stun.range * TILE_SIZE;
  return {
    pieces,
    sniperBarrel: tile(sniperBarrel()),
    turnstileArms: bake(turnstileArms(), 3 * TILE_SIZE, TILE_SIZE),
    lighthouseCone: bake(
      lightCone(coneLength, coneHalfHeight),
      coneLength,
      2 * coneHalfHeight,
    ),
    sirenRing: bake(sirenRing(ringDiameter), ringDiameter, ringDiameter),
    grinderTeeth: tile(grinderTeeth()),
  };
}

/** Seen from a little above: a wide crate at the bottom and a smaller one stacked on it. */
function crateStack(): Graphics {
  const stack = shadow(8, 10, 50, 48, 6);
  crate(stack, 6, 28, 52, 30);
  crate(stack, 12, 6, 40, 26);
  return stack;
}

/** One crate: wood with an outline, two planks and a diagonal brace. */
function crate(
  shape: Graphics,
  left: number,
  top: number,
  width: number,
  height: number,
): void {
  shape
    .roundRect(left, top, width, height, 4)
    .fill(WOOD_COLOUR)
    .stroke(outline());
  const inset = 5;
  shape
    .moveTo(left + inset, top + height / 3)
    .lineTo(left + width - inset, top + height / 3)
    .moveTo(left + inset, top + (2 * height) / 3)
    .lineTo(left + width - inset, top + (2 * height) / 3)
    .moveTo(left + inset, top + inset)
    .lineTo(left + width - inset, top + height - inset)
    .stroke({
      color: OUTLINE_COLOUR,
      width: DETAIL_WIDTH,
      alpha: DETAIL_ALPHA,
    });
}

/** The Turnstile's still middle: a steel post on a round foot. */
function turnstilePost(): Graphics {
  return shadow(18, 18, 28, 28, 14)
    .circle(TILE_MIDDLE, TILE_MIDDLE, 14)
    .fill(METAL_COLOUR)
    .stroke(outline())
    .circle(TILE_MIDDLE, TILE_MIDDLE, 6)
    .fill(DEFENSE_COLOUR)
    .stroke(outline(DETAIL_WIDTH));
}

/** Two gate arms, rails and bars, reaching into the tiles either side; the post covers the middle. */
function turnstileArms(): Graphics {
  const shape = new Graphics();
  const reach = TILE_SIZE - 6;
  const middle = 1.5 * TILE_SIZE;
  for (const side of [-1, 1]) {
    const left = side < 0 ? middle - reach : middle;
    shape
      .roundRect(left, TILE_MIDDLE - 12, reach, 24, 6)
      .fill({ color: DEFENSE_COLOUR, alpha: 0.35 })
      .stroke(outline());
    for (let bar = 1; bar < 5; bar++) {
      const x = middle + (side * (reach * bar)) / 5;
      shape.moveTo(x, TILE_MIDDLE - 12).lineTo(x, TILE_MIDDLE + 12);
    }
    shape.stroke(outline(DETAIL_WIDTH + 1));
  }
  // The rails over the bars, so the gate reads as one solid arm.
  for (const y of [TILE_MIDDLE - 9, TILE_MIDDLE + 9]) {
    shape
      .roundRect(middle - reach, y - 3, 2 * reach, 6, 3)
      .fill(DEFENSE_COLOUR)
      .stroke(outline(DETAIL_WIDTH));
  }
  return shape;
}
