import { Graphics } from "pixi.js";
import {
  BEACON_RED_COLOUR,
  BLOOM_COLOUR,
  DEFENSE_COLOUR,
  EYE_COLOUR,
  LIGHT_WASH_COLOUR,
  METAL_COLOUR,
  OUTLINE_COLOUR,
  SANDBAG_COLOUR,
  SKIN_COLOUR,
} from "./board-view";
import { DETAIL_WIDTH, TILE_MIDDLE, outline, shadow } from "./piece-parts";

/**
 * The tower Pieces, which act on Dudes from their tile: the Sniper Nest, Lighthouse and Siren,
 * and the boss tower, The HR Department. Each stands with a shadow; the moving parts (barrel,
 * light cone, sound ring) are drawn on their own for the battle view to turn or pulse.
 */

/** The Lighthouse's lamp, in the tile's pixels: its beam starts here. */
export const LAMP = { x: TILE_MIDDLE, y: 14 } as const;
/** The beam fades out along its length in these many bands. */
const CONE_BANDS = 4;
const CONE_ALPHA = 0.22;
const RING_WIDTH = 5;

/** A ring of sandbags round a dark pit; the gun sits in the pit. */
export function sandbags(): Graphics {
  const shape = shadow(6, 6, 52, 52, 26);
  const bags = 10;
  for (let bag = 0; bag < bags; bag++) {
    const angle = (bag / bags) * 2 * Math.PI;
    shape
      .ellipse(
        TILE_MIDDLE + Math.cos(angle) * 20,
        TILE_MIDDLE + Math.sin(angle) * 20,
        9,
        7,
      )
      .fill(SANDBAG_COLOUR)
      .stroke(outline(DETAIL_WIDTH + 0.5));
  }
  return shape
    .circle(TILE_MIDDLE, TILE_MIDDLE, 12)
    .fill({ color: OUTLINE_COLOUR, alpha: 0.6 });
}

/** A long barrel with a scope on a round mount, in the defense colour, pointing right. */
export function sniperBarrel(): Graphics {
  return new Graphics()
    .roundRect(TILE_MIDDLE, TILE_MIDDLE - 3.5, 29, 7, 3)
    .fill(DEFENSE_COLOUR)
    .stroke(outline(DETAIL_WIDTH + 0.5))
    .roundRect(TILE_MIDDLE + 6, TILE_MIDDLE - 9, 12, 5, 2.5)
    .fill(METAL_COLOUR)
    .stroke(outline(DETAIL_WIDTH))
    .circle(TILE_MIDDLE, TILE_MIDDLE, 9)
    .fill(DEFENSE_COLOUR)
    .stroke(outline());
}

/** A white tower in red bands, tapering up to a lamp room in the defense colour with its light lit. */
export function lighthouse(): Graphics {
  const shape = shadow(18, 46, 28, 12, 6);
  const bottom = 58;
  const top = 22;
  const widthAt = (y: number) => 12 + ((y - top) / (bottom - top)) * 6;
  const band = (from: number, to: number): number[] => [
    TILE_MIDDLE - widthAt(from),
    from,
    TILE_MIDDLE + widthAt(from),
    from,
    TILE_MIDDLE + widthAt(to),
    to,
    TILE_MIDDLE - widthAt(to),
    to,
  ];
  shape.poly(band(top, bottom)).fill(EYE_COLOUR);
  shape.poly(band(30, 38)).poly(band(46, 54)).fill(BEACON_RED_COLOUR);
  shape
    .poly(band(top, bottom))
    .stroke(outline())
    .roundRect(TILE_MIDDLE - 15, top - 3, 30, 5, 2)
    .fill(OUTLINE_COLOUR);
  return shape
    .roundRect(TILE_MIDDLE - 9, 8, 18, 13, 3)
    .fill(DEFENSE_COLOUR)
    .stroke(outline())
    .circle(LAMP.x, LAMP.y, 4)
    .fill(BLOOM_COLOUR)
    .moveTo(TILE_MIDDLE - 9, 8)
    .quadraticCurveTo(TILE_MIDDLE, -2, TILE_MIDDLE + 9, 8)
    .closePath()
    .fill(BEACON_RED_COLOUR)
    .stroke(outline());
}

/** The beam: a wedge from its point, brightest near the lamp and fading toward its far end. */
export function lightCone(length: number, halfHeight: number): Graphics {
  const shape = new Graphics();
  for (let band = CONE_BANDS; band >= 1; band--) {
    const reach = (length * band) / CONE_BANDS;
    const spread = (halfHeight * band) / CONE_BANDS;
    shape
      .poly([
        0,
        halfHeight,
        reach,
        halfHeight - spread,
        reach,
        halfHeight + spread,
      ])
      .fill({ color: LIGHT_WASH_COLOUR, alpha: CONE_ALPHA });
  }
  return shape;
}

/** A pole on a round foot with a loudspeaker horn on top, its horn in the defense colour. */
export function siren(): Graphics {
  return shadow(20, 46, 24, 12, 6)
    .ellipse(TILE_MIDDLE, 54, 12, 5)
    .fill(METAL_COLOUR)
    .stroke(outline())
    .roundRect(TILE_MIDDLE - 3, 22, 6, 32, 3)
    .fill(METAL_COLOUR)
    .stroke(outline())
    .poly([24, 17, 36, 17, 50, 6, 50, 34, 36, 25, 24, 25])
    .fill(DEFENSE_COLOUR)
    .stroke(outline())
    .ellipse(50, 20, 3, 14)
    .fill(OUTLINE_COLOUR)
    .moveTo(55, 13)
    .quadraticCurveTo(60, 20, 55, 27)
    .stroke(outline(DETAIL_WIDTH));
}

/** One ring of sound, in the defense colour; the battle view grows and fades it from the Siren. */
export function sirenRing(diameter: number): Graphics {
  const radius = diameter / 2;
  return new Graphics()
    .circle(radius, radius, radius - RING_WIDTH)
    .stroke({ color: OUTLINE_COLOUR, width: RING_WIDTH + 2, alpha: 0.5 })
    .circle(radius, radius, radius - RING_WIDTH)
    .stroke({ color: DEFENSE_COLOUR, width: RING_WIDTH });
}

/** A grey office desk with an "HR" sign in the defense colour, and a stern face behind it. */
export function hrDepartment(): Graphics {
  const shape = shadow(6, 30, 52, 28, 4);
  shape
    .circle(TILE_MIDDLE, 20, 11)
    .fill(SKIN_COLOUR)
    .stroke(outline())
    // Frowning brows and a flat mouth.
    .moveTo(23, 14)
    .lineTo(30, 17)
    .moveTo(41, 14)
    .lineTo(34, 17)
    .moveTo(28, 25)
    .lineTo(36, 25)
    .stroke(outline(DETAIL_WIDTH + 0.5))
    .circle(28, 19, 1.6)
    .circle(36, 19, 1.6)
    .fill(OUTLINE_COLOUR);
  shape
    .roundRect(6, 30, 52, 9, 3)
    .fill(METAL_COLOUR)
    .stroke(outline())
    .rect(10, 39, 6, 18)
    .rect(48, 39, 6, 18)
    .fill(METAL_COLOUR)
    .stroke(outline());
  // The sign on the desk's front, its letters drawn as strokes so no font is needed.
  shape.roundRect(18, 38, 28, 17, 3).fill(DEFENSE_COLOUR).stroke(outline());
  return shape
    .moveTo(23, 42)
    .lineTo(23, 51)
    .moveTo(30, 42)
    .lineTo(30, 51)
    .moveTo(23, 46.5)
    .lineTo(30, 46.5)
    .moveTo(34, 51)
    .lineTo(34, 42)
    .lineTo(38, 42)
    .quadraticCurveTo(42, 44.25, 38, 46.5)
    .lineTo(34, 46.5)
    .moveTo(37.5, 46.5)
    .lineTo(41, 51)
    .stroke({ color: EYE_COLOUR, width: 2.2, cap: "round", join: "round" });
}
