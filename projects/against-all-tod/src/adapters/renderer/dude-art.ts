import { Graphics, type Texture } from "pixi.js";
import { DUDE_KINDS, type DudeKindId } from "../../catalog/dudes";
import {
  ATTACK_COLOUR,
  EYE_COLOUR,
  METAL_COLOUR,
  OUTLINE_COLOUR,
  SHADOW_ALPHA,
  SHADOW_COLOUR,
  WOOD_COLOUR,
} from "./board-view";

/** A Dude's two baked looks: walking along, and panicked for a moment after a hit. */
export interface DudeFaces {
  readonly calm: Texture;
  readonly panicked: Texture;
}

export interface DudeTextures {
  /** Every kind's look; kinds not drawn yet wear the Intern's body. */
  readonly dudes: Readonly<Record<DudeKindId, DudeFaces>>;
  /** A Shield Bro once his shield breaks. */
  readonly shieldBroUnshielded: DudeFaces;
  /** A soft round glow in white, tinted the attack colour under each Dude in the dark. */
  readonly dudeGlow: Texture;
}

/** Bakes a shape into a texture `width` by `height` px from its top left, then destroys it. */
export type Bake = (shape: Graphics, width: number, height: number) => Texture;

/** Every Dude is drawn in a square this many px wide, centred on the Dude's point. */
export const DUDE_FRAME = 48;
/** A blob's outline: a touch thinner than the Board's, as Dudes are drawn small. */
const DUDE_OUTLINE = 2.5;
const LEG_WIDTH = 2;
/** Glow is drawn white so a sprite tint can colour it. */
const TINTABLE_WHITE = 0xffffff;
const GLOW_RINGS = 8;
const GLOW_RING_ALPHA = 0.14;
const HIGHLIGHT_ALPHA = 0.35;

type Face = "calm" | "panicked";
type Drawing = (face: Face) => Graphics;

/** The kinds with their own drawing so far; ticket 30 draws the rest. */
const DRAWINGS: Partial<Record<DudeKindId, Drawing>> = {
  intern,
  termite,
  "ram-crew": ramCrew,
  balloonist,
  "shield-bro": (face) => shieldBro(face, true),
};

export function drawDudeTextures(bake: Bake): DudeTextures {
  const faces = (drawing: Drawing): DudeFaces => ({
    calm: bake(drawing("calm"), DUDE_FRAME, DUDE_FRAME),
    panicked: bake(drawing("panicked"), DUDE_FRAME, DUDE_FRAME),
  });
  const internFaces = faces(intern);
  const dudes = Object.fromEntries(
    Object.values(DUDE_KINDS).map(({ id }) => {
      const drawing = DRAWINGS[id];
      return [id, drawing === undefined ? internFaces : faces(drawing)];
    }),
  ) as Record<DudeKindId, DudeFaces>;
  return {
    dudes,
    shieldBroUnshielded: faces((face) => shieldBro(face, false)),
    dudeGlow: bake(glow(), DUDE_FRAME, DUDE_FRAME),
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

/** Drawn first, so everything stands on it: a flat oval at (x, y) half `halfWidth` wide. */
function shadow(x: number, y: number, halfWidth: number): Graphics {
  return new Graphics()
    .ellipse(x, y, halfWidth, halfWidth * 0.3)
    .fill({ color: SHADOW_COLOUR, alpha: SHADOW_ALPHA });
}

/** A body or head in the attack colour with the dark outline. */
function blob(
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
function eyes(
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
