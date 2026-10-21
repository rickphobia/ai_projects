import { Graphics, type Texture } from "pixi.js";
import { DUDE_KINDS, type DudeKindId } from "../../catalog/dudes";
import {
  ATTACK_COLOUR,
  BLOOM_COLOUR,
  EYE_COLOUR,
  METAL_COLOUR,
  OUTLINE_COLOUR,
  WOOD_COLOUR,
} from "./board-view";
import { congaHands, fuse, goldGrin, type Mouth } from "./dude-marks";
import {
  DUDE_FRAME,
  DUDE_OUTLINE,
  HIGHLIGHT_ALPHA,
  LEG_WIDTH,
  blob,
  eyes,
  shadow,
  type Face,
} from "./dude-parts";

export { DUDE_FRAME } from "./dude-parts";

/**
 * A Dude's two baked looks: walking along, and panicked for a moment after a hit. Plus Gold
 * Teeth's grin, drawn alone in the same frame at this kind's mouth, to lay over either look.
 */
export interface DudeFaces {
  readonly calm: Texture;
  readonly panicked: Texture;
  readonly goldGrin: Texture;
}

export interface DudeTextures {
  /** Every kind's look. */
  readonly dudes: Readonly<Record<DudeKindId, DudeFaces>>;
  /** A Shield Bro once his shield breaks. */
  readonly shieldBroUnshielded: DudeFaces;
  /** Explosive Shields' mark: a lit fuse on top, in the Dude's frame, laid over any kind. */
  readonly fuse: Texture;
  /** Conga Line's mark: two hands held out in front, on the shoulders of the Dude ahead. */
  readonly congaHands: Texture;
  /** A soft round glow in white, tinted the attack colour under each Dude in the dark. */
  readonly dudeGlow: Texture;
}

/** Bakes a shape into a texture `width` by `height` px from its top left, then destroys it. */
export type Bake = (shape: Graphics, width: number, height: number) => Texture;

/** Glow is drawn white so a sprite tint can colour it. */
const TINTABLE_WHITE = 0xffffff;
const GLOW_RINGS = 8;
const GLOW_RING_ALPHA = 0.14;

type Drawing = (face: Face) => Graphics;

/** Every kind's drawing and mouth. A Record, so a new kind in the catalog fails to compile until drawn. */
const DRAWINGS: Readonly<Record<DudeKindId, readonly [Drawing, Mouth]>> = {
  intern: [intern, { x: 27, y: 27, width: 7 }],
  termite: [termite, { x: 34, y: 30, width: 5 }],
  "ram-crew": [ramCrew, { x: 30, y: 20, width: 3 }],
  balloonist: [balloonist, { x: 26, y: 41, width: 5 }],
  "shield-bro": [(face) => shieldBro(face, true), { x: 22, y: 28, width: 7 }],
  "hype-man": [hypeMan, { x: 26, y: 29, width: 6 }],
  sapper: [sapper, { x: 28, y: 30, width: 7 }],
  mole: [mole, { x: 25, y: 29, width: 6 }],
  streaker: [streaker, { x: 30, y: 27, width: 7 }],
  landlord: [landlord, { x: 27, y: 31, width: 8 }],
};

export function drawDudeTextures(bake: Bake): DudeTextures {
  const frame = (shape: Graphics): Texture =>
    bake(shape, DUDE_FRAME, DUDE_FRAME);
  const faces = (drawing: Drawing, mouth: Mouth): DudeFaces => ({
    calm: frame(drawing("calm")),
    panicked: frame(drawing("panicked")),
    goldGrin: frame(goldGrin(mouth)),
  });
  const dudes = Object.fromEntries(
    Object.values(DUDE_KINDS).map(({ id }) => [id, faces(...DRAWINGS[id])]),
  ) as Record<DudeKindId, DudeFaces>;
  return {
    dudes,
    shieldBroUnshielded: faces(
      (face) => shieldBro(face, false),
      DRAWINGS["shield-bro"][1],
    ),
    fuse: frame(fuse()),
    congaHands: frame(congaHands()),
    dudeGlow: frame(glow()),
  };
}

/** Small and round, with a long tie: light on the dark outline, so it reads as a tie and not a beard. */
function intern(face: Face): Graphics {
  const shape = shadow(24, 39, 10);
  blob(shape, 24, 27, 11, 12);
  eyes(shape, 27, 22, 3.5, face);
  return shape
    .poly([25, 28.5, 29, 28.5, 28, 31, 26, 31])
    .poly([26, 31, 28, 31, 30, 38, 27, 41, 24, 38])
    .fill(EYE_COLOUR)
    .stroke({ color: OUTLINE_COLOUR, width: 1.2 });
}

/** A bug: a long back end, a round head looking ahead, six legs and two antennae. */
function termite(face: Face): Graphics {
  const shape = shadow(24, 38, 15);
  for (const x of [14, 21, 28]) {
    shape
      .moveTo(x, 30)
      .lineTo(x - 3, 38)
      .moveTo(x, 30)
      .lineTo(x + 3, 38);
  }
  shape.stroke({ color: OUTLINE_COLOUR, width: LEG_WIDTH, cap: "round" });
  blob(shape, 17, 29, 11, 8);
  blob(shape, 32, 26, 8, 8);
  shape
    .moveTo(30, 19)
    .quadraticCurveTo(28, 12, 31, 8)
    .moveTo(35, 19)
    .quadraticCurveTo(38, 12, 42, 10)
    .stroke({ color: OUTLINE_COLOUR, width: LEG_WIDTH, cap: "round" })
    .circle(31, 8, 2)
    .circle(42, 10, 2)
    .fill(OUTLINE_COLOUR);
  eyes(shape, 33, 25, 3, face);
  return shape;
}

/** Four little heads with a log across their shoulders. */
function ramCrew(face: Face): Graphics {
  const shape = shadow(24, 36, 22);
  for (const x of [9, 19, 29, 39]) {
    blob(shape, x, 17, 5.5, 6);
    eyes(shape, x + 1, 15, 2, face);
  }
  return shape
    .roundRect(3, 20, 42, 12, 6)
    .fill(WOOD_COLOUR)
    .stroke({ color: OUTLINE_COLOUR, width: DUDE_OUTLINE })
    .circle(39, 26, 3)
    .stroke({ color: OUTLINE_COLOUR, width: LEG_WIDTH, alpha: 0.5 });
}

/** A little Dude hanging under a big balloon; his shadow falls far below, as he flies. */
function balloonist(face: Face): Graphics {
  const shape = shadow(24, 45, 7);
  shape
    .moveTo(24, 26)
    .lineTo(24, 32)
    .stroke({ color: OUTLINE_COLOUR, width: LEG_WIDTH });
  blob(shape, 24, 14, 11, 12);
  shape
    .poly([21, 27, 27, 27, 24, 24])
    .fill(ATTACK_COLOUR)
    .stroke({ color: OUTLINE_COLOUR, width: LEG_WIDTH })
    .ellipse(20, 10, 3, 4.5)
    .fill({ color: EYE_COLOUR, alpha: HIGHLIGHT_ALPHA });
  blob(shape, 24, 38, 7.5, 7);
  eyes(shape, 26, 37, 2.5, face);
  return shape;
}

/** A blob behind a tall shield held out in front; without it, a plain blob. */
function shieldBro(face: Face, shielded: boolean): Graphics {
  const shape = shadow(24, 40, 14);
  blob(shape, 21, 27, 12, 13);
  eyes(shape, 22, 21, 3.5, face);
  if (!shielded) return shape;
  return shape
    .roundRect(28, 11, 13, 31, 6)
    .fill(METAL_COLOUR)
    .stroke({ color: OUTLINE_COLOUR, width: DUDE_OUTLINE })
    .moveTo(34.5, 15)
    .lineTo(34.5, 38)
    .stroke({ color: OUTLINE_COLOUR, width: LEG_WIDTH, alpha: 0.5 });
}

/** Shouting ahead through a big megaphone held up to his mouth. */
function hypeMan(face: Face): Graphics {
  const shape = shadow(24, 40, 13);
  blob(shape, 21, 29, 11, 12);
  eyes(shape, 22, 23, 3.2, face);
  return shape
    .poly([29, 26, 44, 18, 44, 36, 29, 31])
    .fill(METAL_COLOUR)
    .stroke({ color: OUTLINE_COLOUR, width: DUDE_OUTLINE, join: "round" })
    .ellipse(44, 27, 2.5, 9)
    .fill(OUTLINE_COLOUR);
}

/** A round black bomb strapped to his back, its fuse already lit. */
function sapper(face: Face): Graphics {
  const shape = shadow(24, 40, 15);
  shape
    .circle(13, 25, 9)
    .fill(OUTLINE_COLOUR)
    .circle(10, 22, 2.5)
    .fill({ color: EYE_COLOUR, alpha: HIGHLIGHT_ALPHA })
    .moveTo(10, 17)
    .quadraticCurveTo(7, 11, 10, 7)
    .stroke({ color: OUTLINE_COLOUR, width: LEG_WIDTH, cap: "round" })
    .circle(10, 7, 2.5)
    .fill(BLOOM_COLOUR);
  blob(shape, 27, 29, 11, 12);
  eyes(shape, 29, 23, 3.3, face);
  return shape;
}

/** Just a head poking out of a mound of dirt. */
function mole(face: Face): Graphics {
  const shape = shadow(24, 41, 18);
  blob(shape, 24, 26, 9, 10);
  eyes(shape, 25, 22, 3, face);
  return shape
    .moveTo(5, 41)
    .quadraticCurveTo(10, 29, 18, 31)
    .quadraticCurveTo(24, 34, 30, 31)
    .quadraticCurveTo(38, 29, 43, 41)
    .closePath()
    .fill(WOOD_COLOUR)
    .stroke({ color: OUTLINE_COLOUR, width: DUDE_OUTLINE, join: "round" })
    .circle(14, 37, 1.5)
    .circle(33, 36, 1.5)
    .fill({ color: OUTLINE_COLOUR, alpha: 0.5 });
}

/** Bare and leaning into a sprint, with motion lines streaming behind. */
function streaker(face: Face): Graphics {
  const shape = shadow(28, 39, 11);
  for (const [y, length] of [
    [20, 9],
    [27, 12],
    [34, 9],
  ] as const) {
    shape.moveTo(14 - length, y).lineTo(14, y);
  }
  shape.stroke({ color: OUTLINE_COLOUR, width: LEG_WIDTH, cap: "round" });
  blob(shape, 28, 27, 10, 11);
  eyes(shape, 30, 21, 3.2, face);
  return shape
    .ellipse(24, 22, 2.5, 4)
    .fill({ color: EYE_COLOUR, alpha: HIGHLIGHT_ALPHA });
}

/** A big round boss in a top hat, leaning on a cane. */
function landlord(face: Face): Graphics {
  const shape = shadow(24, 42, 16);
  shape
    .moveTo(39, 43)
    .lineTo(39, 24)
    .quadraticCurveTo(39, 19, 44, 21)
    .stroke({ color: OUTLINE_COLOUR, width: 2.5, cap: "round" });
  blob(shape, 24, 31, 14, 12);
  eyes(shape, 26, 25, 3.5, face);
  return shape
    .roundRect(13, 15, 24, 4, 2)
    .roundRect(17, 2, 16, 14, 2)
    .fill(OUTLINE_COLOUR)
    .rect(17, 11, 16, 3)
    .fill(ATTACK_COLOUR);
}

/** Rings growing fainter outward; overlapping, they glow brightest in the middle. */
function glow(): Graphics {
  const shape = new Graphics();
  const middle = DUDE_FRAME / 2;
  for (let ring = 1; ring <= GLOW_RINGS; ring++) {
    shape
      .circle(middle, middle, (middle * ring) / GLOW_RINGS)
      .fill({ color: TINTABLE_WHITE, alpha: GLOW_RING_ALPHA });
  }
  return shape;
}
