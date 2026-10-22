import { Graphics, Rectangle, type Renderer, type Texture } from "pixi.js";
import { goalTiles } from "../../maze/board";
import { TILE_SIZE } from "./board-textures";
import { drawDudeTextures, type DudeTextures } from "./dude-art";
import { drawEffectTextures, type EffectTextures } from "./effect-art";
import { drawPieceTextures, type PieceTextures } from "./piece-art";
import {
  ATTACK_COLOUR,
  BLOOM_COLOUR,
  CARPET_COLOUR,
  DEFENSE_COLOUR,
  GRASS_DARK_COLOUR,
  GRASS_LIGHT_COLOUR,
  LEAF_COLOUR,
  OFFICE_COLOUR,
  OUTLINE_COLOUR,
  OUTLINE_WIDTH,
  PETAL_COLOUR,
  SHADOW_ALPHA,
  SHADOW_COLOUR,
  SHADOW_OFFSET,
  WOOD_COLOUR,
} from "./board-view";

/** The shapes drawn in code (decision 0005), each baked once into a texture. */
export interface ArtTextures
  extends DudeTextures, PieceTextures, EffectTextures {
  /** One grass tile in each shade; the Board checkers them. */
  readonly grassLight: Texture;
  readonly grassDark: Texture;
  /** One tile of the Spawn zone's striped carpet; its stripes run on into the next tile. */
  readonly carpet: Texture;
  /** The Goal: a little office building as tall as the Goal's tiles. */
  readonly office: Texture;
  readonly flower: Texture;
  readonly tuft: Texture;
  readonly tree: Texture;
  readonly bush: Texture;
}

/** Diagonal carpet stripes repeat a whole number of times per tile, so tiles join seamlessly. */
const STRIPE_PERIOD = TILE_SIZE / 4;
const STRIPE_WIDTH = 7;
const STRIPE_ALPHA = 0.45;
const WINDOW_ALPHA = 0.8;
const HIGHLIGHT_ALPHA = 0.35;
const DECORATION_SIZE = 16;
const TREE_SIZE = 60;
const BUSH_SIZE = 38;

/**
 * Draws the art kit's shapes and bakes each into a texture at `resolution`, so the views can keep
 * using batched sprites. Call once at start-up.
 */
export function drawArtTextures(
  renderer: Renderer,
  resolution: number,
): ArtTextures {
  const bake = (shape: Graphics, width: number, height: number): Texture => {
    const texture = renderer.generateTexture({
      target: shape,
      frame: new Rectangle(0, 0, width, height),
      resolution,
      antialias: true,
    });
    shape.destroy();
    return texture;
  };
  const officeHeight = goalTiles().length * TILE_SIZE;
  return {
    grassLight: bake(grassTile(GRASS_LIGHT_COLOUR), TILE_SIZE, TILE_SIZE),
    grassDark: bake(grassTile(GRASS_DARK_COLOUR), TILE_SIZE, TILE_SIZE),
    carpet: bake(carpetTile(), TILE_SIZE, TILE_SIZE),
    office: bake(office(officeHeight), TILE_SIZE, officeHeight),
    flower: bake(flower(), DECORATION_SIZE, DECORATION_SIZE),
    tuft: bake(tuft(), DECORATION_SIZE, DECORATION_SIZE),
    tree: bake(canopy(TREE_SIZE, 4), TREE_SIZE, TREE_SIZE),
    bush: bake(canopy(BUSH_SIZE, 3), BUSH_SIZE, BUSH_SIZE),
    ...drawDudeTextures(bake),
    ...drawPieceTextures(bake),
    ...drawEffectTextures(bake),
  };
}

function grassTile(colour: number): Graphics {
  return new Graphics().rect(0, 0, TILE_SIZE, TILE_SIZE).fill(colour);
}

function carpetTile(): Graphics {
  const carpet = new Graphics()
    .rect(0, 0, TILE_SIZE, TILE_SIZE)
    .fill(CARPET_COLOUR);
  // Bands along x + y = k × period; the baked frame clips the ones that run off the tile.
  for (let start = -TILE_SIZE; start < 2 * TILE_SIZE; start += STRIPE_PERIOD) {
    carpet.poly([
      start,
      0,
      start + STRIPE_WIDTH,
      0,
      start + STRIPE_WIDTH - TILE_SIZE,
      TILE_SIZE,
      start - TILE_SIZE,
      TILE_SIZE,
    ]);
  }
  return carpet.fill({ color: ATTACK_COLOUR, alpha: STRIPE_ALPHA });
}

/** An office block in the defense colour: a roof band, rows of windows and a door at the bottom. */
function office(height: number): Graphics {
  const left = 7;
  const top = 8;
  const width = TILE_SIZE - 2 * left;
  const bodyHeight = height - top - 6;
  const building = new Graphics()
    .roundRect(left + SHADOW_OFFSET, top + SHADOW_OFFSET, width, bodyHeight, 6)
    .fill({ color: SHADOW_COLOUR, alpha: SHADOW_ALPHA })
    .roundRect(left, top, width, bodyHeight, 6)
    .fill(OFFICE_COLOUR)
    .stroke({ color: OUTLINE_COLOUR, width: OUTLINE_WIDTH })
    .roundRect(left, top, width, 14, 6)
    .fill(DEFENSE_COLOUR)
    .stroke({ color: OUTLINE_COLOUR, width: OUTLINE_WIDTH });
  const windowSize = 11;
  const doorHeight = 20;
  for (
    let y = top + 22;
    y + windowSize < top + bodyHeight - doorHeight - 6;
    y += 17
  ) {
    for (const x of [left + 8, left + width - 8 - windowSize]) {
      building.roundRect(x, y, windowSize, windowSize, 2);
    }
  }
  building
    .fill({ color: DEFENSE_COLOUR, alpha: WINDOW_ALPHA })
    .stroke({ color: OUTLINE_COLOUR, width: 2 });
  return building
    .roundRect(
      TILE_SIZE / 2 - 8,
      top + bodyHeight - doorHeight,
      16,
      doorHeight,
      3,
    )
    .fill(WOOD_COLOUR)
    .stroke({ color: OUTLINE_COLOUR, width: 2 });
}

function flower(): Graphics {
  const middle = DECORATION_SIZE / 2;
  const shape = new Graphics();
  for (let petal = 0; petal < 5; petal++) {
    const angle = (petal / 5) * 2 * Math.PI;
    shape.circle(middle + Math.cos(angle) * 4, middle + Math.sin(angle) * 4, 3);
  }
  return shape
    .fill(PETAL_COLOUR)
    .circle(middle, middle, 2.5)
    .fill(BLOOM_COLOUR);
}

/** Three blades of grass, darker than the tiles. */
function tuft(): Graphics {
  const base = DECORATION_SIZE - 2;
  return new Graphics()
    .poly([2, base, 5, 3, 8, base])
    .poly([6, base, 9, 1, 12, base])
    .poly([10, base, 14, 5, 15, base])
    .fill(LEAF_COLOUR);
}

/** A tree or bush from above: a clump of leafy circles with a shadow and a highlight. */
function canopy(size: number, lobes: number): Graphics {
  const middle = size / 2;
  const radius = size * 0.24;
  const spread = size * 0.17;
  const centres = Array.from({ length: lobes }, (_, lobe) => {
    const angle = (lobe / lobes) * 2 * Math.PI - Math.PI / 2;
    return {
      x: middle + Math.cos(angle) * spread,
      y: middle + Math.sin(angle) * spread,
    };
  });
  const shape = new Graphics();
  for (const { x, y } of centres) {
    shape.circle(x + SHADOW_OFFSET, y + SHADOW_OFFSET, radius);
  }
  shape.fill({ color: SHADOW_COLOUR, alpha: SHADOW_ALPHA });
  for (const { x, y } of centres) shape.circle(x, y, radius);
  shape.circle(middle, middle, radius);
  shape
    .fill(LEAF_COLOUR)
    .stroke({ color: OUTLINE_COLOUR, width: OUTLINE_WIDTH });
  // Strokes go round each circle; a fill over the middle hides the inner arcs so the clump reads as one.
  for (const { x, y } of centres)
    shape.circle(x, y, radius - OUTLINE_WIDTH / 2);
  shape.circle(middle, middle, radius);
  return shape
    .fill(LEAF_COLOUR)
    .circle(middle - radius * 0.4, middle - radius * 0.5, radius * 0.45)
    .fill({ color: GRASS_LIGHT_COLOUR, alpha: HIGHLIGHT_ALPHA });
}
