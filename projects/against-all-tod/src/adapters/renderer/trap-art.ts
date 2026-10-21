import { Graphics } from "pixi.js";
import {
  CARDBOARD_COLOUR,
  DEFENSE_COLOUR,
  EYE_COLOUR,
  METAL_COLOUR,
  OFFICE_COLOUR,
  OUTLINE_COLOUR,
  SKIN_COLOUR,
} from "./board-view";
import {
  DETAIL_ALPHA,
  DETAIL_WIDTH,
  TILE_MIDDLE,
  outline,
  shadow,
} from "./piece-parts";

/**
 * The trap Pieces, the ones with a `trap` in the catalog. The Tax Booth and Grinder are floor
 * Pieces, drawn flat with no shadow so they read as walked over; the Bouncer and Decoy Goal
 * stand like walls.
 */

/** The Grinder's teeth: a cog this many teeth round, turned by the battle view. */
const GRINDER_TEETH = 8;
/** The Decoy Goal leans this far (radians), so it reads as a flimsy copy of the real office. */
const DECOY_LEAN = 0.12;

/** From above: a little ticket booth in the corner and a striped barrier arm across the lane. */
export function taxBooth(): Graphics {
  const shape = new Graphics()
    .roundRect(6, 6, 52, 52, 8)
    .fill(OFFICE_COLOUR)
    .stroke(outline());
  shape
    .roundRect(10, 10, 20, 20, 4)
    .fill(METAL_COLOUR)
    .stroke(outline())
    .roundRect(13, 13, 14, 14, 3)
    .fill(DEFENSE_COLOUR)
    .stroke(outline(DETAIL_WIDTH));
  // The barrier arm: a striped pole from the booth across the tile, its stripes in the defense colour.
  shape.roundRect(18, 36, 38, 8, 4).fill(EYE_COLOUR);
  for (let x = 24; x < 54; x += 10) shape.rect(x, 36, 5, 8);
  return shape
    .fill(DEFENSE_COLOUR)
    .roundRect(18, 36, 38, 8, 4)
    .stroke(outline(DETAIL_WIDTH))
    .circle(18, 40, 5)
    .fill(METAL_COLOUR)
    .stroke(outline(DETAIL_WIDTH));
}

/** A flat steel plate with bolts in its corners and a slot the teeth turn in. */
export function grinderPlate(): Graphics {
  const shape = new Graphics()
    .roundRect(6, 6, 52, 52, 8)
    .fill(METAL_COLOUR)
    .stroke(outline());
  for (const x of [12, 52]) {
    for (const y of [12, 52]) shape.circle(x, y, 2.5);
  }
  return shape
    .fill({ color: OUTLINE_COLOUR, alpha: DETAIL_ALPHA })
    .circle(TILE_MIDDLE, TILE_MIDDLE, 21)
    .fill(OUTLINE_COLOUR);
}

/** A cog of sharp teeth round a hub, centred in the tile so it spins on the spot. */
export function grinderTeeth(): Graphics {
  const points: number[] = [];
  for (let tooth = 0; tooth < GRINDER_TEETH * 2; tooth++) {
    const angle = (tooth / (GRINDER_TEETH * 2)) * 2 * Math.PI;
    const radius = tooth % 2 === 0 ? 19 : 12;
    points.push(
      TILE_MIDDLE + Math.cos(angle) * radius,
      TILE_MIDDLE + Math.sin(angle) * radius,
    );
  }
  return new Graphics()
    .poly(points)
    .fill(DEFENSE_COLOUR)
    .stroke(outline(DETAIL_WIDTH))
    .circle(TILE_MIDDLE, TILE_MIDDLE, 5)
    .fill(METAL_COLOUR)
    .stroke(outline(DETAIL_WIDTH));
}

/** A big guy filling the tile: broad shoulders, a shirt in the defense colour, shades, arms crossed. */
export function bouncer(): Graphics {
  const shape = shadow(8, 18, 48, 40, 16);
  shape
    .roundRect(8, 26, 48, 32, 14)
    .fill(DEFENSE_COLOUR)
    .stroke(outline())
    .circle(TILE_MIDDLE, 17, 12)
    .fill(SKIN_COLOUR)
    .stroke(outline());
  // Shades: two dark lenses joined by a bar.
  shape
    .roundRect(21, 13, 10, 6, 2)
    .roundRect(33, 13, 10, 6, 2)
    .rect(30, 14, 4, 2)
    .fill(OUTLINE_COLOUR)
    .moveTo(27, 24)
    .lineTo(37, 24)
    .stroke(outline(DETAIL_WIDTH));
  // Crossed arms: two thick forearms over the chest, one over the other.
  return shape
    .roundRect(12, 36, 34, 11, 5.5)
    .fill(SKIN_COLOUR)
    .stroke(outline())
    .roundRect(18, 41, 34, 11, 5.5)
    .fill(SKIN_COLOUR)
    .stroke(outline());
}

/** The Goal's office again, in cardboard, leaning: a roof band in the defense colour and drawn-on windows. */
export function decoyGoal(): Graphics {
  const lean = (x: number, y: number): [number, number] => {
    const dx = x - TILE_MIDDLE;
    const dy = y - 58;
    return [
      TILE_MIDDLE + dx * Math.cos(DECOY_LEAN) - dy * Math.sin(DECOY_LEAN),
      58 + dx * Math.sin(DECOY_LEAN) + dy * Math.cos(DECOY_LEAN),
    ];
  };
  const box = (left: number, top: number, width: number, height: number) => [
    ...lean(left, top),
    ...lean(left + width, top),
    ...lean(left + width, top + height),
    ...lean(left, top + height),
  ];
  const shape = shadow(14, 10, 36, 48, 4);
  shape
    .poly(box(14, 8, 36, 50))
    .fill(CARDBOARD_COLOUR)
    .stroke(outline())
    .poly(box(14, 8, 36, 10))
    .fill(DEFENSE_COLOUR)
    .stroke(outline());
  for (const top of [23, 35]) {
    for (const left of [19, 37]) shape.poly(box(left, top, 8, 8));
  }
  shape.stroke(outline(DETAIL_WIDTH));
  // A strip of tape holding a flap down, and the door drawn on.
  return shape
    .poly(box(10, 44, 16, 5))
    .fill({ color: OFFICE_COLOUR, alpha: 0.8 })
    .poly(box(28, 46, 9, 12))
    .stroke(outline(DETAIL_WIDTH));
}
