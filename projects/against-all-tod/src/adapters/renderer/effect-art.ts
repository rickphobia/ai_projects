import { Graphics, type Texture } from "pixi.js";
import { TILE_SIZE } from "./board-textures";
import {
  BLOOM_COLOUR,
  DEFENSE_COLOUR,
  OFFICE_COLOUR,
  OUTLINE_COLOUR,
  OUTLINE_WIDTH,
  PETAL_COLOUR,
  SHADOW_ALPHA,
  SHADOW_COLOUR,
  SHADOW_OFFSET,
  WOOD_COLOUR,
} from "./board-view";

/** The effects' shapes, each baked once; the effects view moves pooled sprites of them. */
export interface EffectTextures {
  /** The Sniper Nest's bullet, drawn pointing right, in the defense colour. */
  readonly bullet: Texture;
  /** The star puff where a shot lands. */
  readonly starPuff: Texture;
  /** The spiky "bonk" burst where a Wall-breaker hits a Piece. */
  readonly bonk: Texture;
  /** The coin beside a "+Xg" gold pop. */
  readonly coin: Texture;
  /** What is left of the Goal's office once it breaks: a heap as wide as one tile. */
  readonly rubble: Texture;
}

export const BULLET_WIDTH = 22;
export const BULLET_HEIGHT = 10;
export const PUFF_SIZE = 36;
export const BONK_SIZE = 44;
export const COIN_SIZE = 26;
/** The rubble heap is this tall; it sits at the bottom of the Goal's tiles. */
export const RUBBLE_HEIGHT = 56;

type Bake = (shape: Graphics, width: number, height: number) => Texture;

export function drawEffectTextures(bake: Bake): EffectTextures {
  return {
    bullet: bake(bullet(), BULLET_WIDTH, BULLET_HEIGHT),
    starPuff: bake(starPuff(), PUFF_SIZE, PUFF_SIZE),
    bonk: bake(bonk(), BONK_SIZE, BONK_SIZE),
    coin: bake(coin(), COIN_SIZE, COIN_SIZE),
    rubble: bake(rubble(), TILE_SIZE, RUBBLE_HEIGHT),
  };
}

/** A rounded slug with a pale tip, so it reads as moving right. */
function bullet(): Graphics {
  const middle = BULLET_HEIGHT / 2;
  return new Graphics()
    .roundRect(2, 2, BULLET_WIDTH - 4, BULLET_HEIGHT - 4, middle - 2)
    .fill(DEFENSE_COLOUR)
    .stroke({ color: OUTLINE_COLOUR, width: 2 })
    .circle(BULLET_WIDTH - 6, middle, 2)
    .fill(PETAL_COLOUR);
}

/** A five-pointed star, white with a yellow heart. */
function starPuff(): Graphics {
  const middle = PUFF_SIZE / 2;
  return new Graphics()
    .star(middle, middle, 5, middle - 3, middle / 2.2, -Math.PI / 2)
    .fill(PETAL_COLOUR)
    .stroke({ color: OUTLINE_COLOUR, width: 2 })
    .circle(middle, middle, middle / 4)
    .fill(BLOOM_COLOUR);
}

/** A jagged burst, like a comic's "bonk". */
function bonk(): Graphics {
  const middle = BONK_SIZE / 2;
  return new Graphics()
    .star(middle, middle, 9, middle - 4, middle * 0.55, 0.2)
    .fill(BLOOM_COLOUR)
    .stroke({ color: OUTLINE_COLOUR, width: OUTLINE_WIDTH })
    .star(middle, middle, 9, middle * 0.5, middle * 0.3, 0.2)
    .fill(PETAL_COLOUR);
}

function coin(): Graphics {
  const middle = COIN_SIZE / 2;
  return new Graphics()
    .circle(middle, middle, middle - 2)
    .fill(BLOOM_COLOUR)
    .stroke({ color: OUTLINE_COLOUR, width: 2 })
    .circle(middle, middle, middle / 2.4)
    .stroke({ color: OUTLINE_COLOUR, width: 1.5, alpha: 0.5 });
}

/** Broken office walls, a few blue roof pieces and a plank, heaped up with a shadow. */
function rubble(): Graphics {
  const base = RUBBLE_HEIGHT - 4;
  const heap = [6, base, 14, 24, 26, 14, 40, 18, 52, 28, 58, base];
  const shadow = heap.map((value, index) =>
    index % 2 === 0 ? value + SHADOW_OFFSET : value + SHADOW_OFFSET / 2,
  );
  return new Graphics()
    .poly(shadow)
    .fill({ color: SHADOW_COLOUR, alpha: SHADOW_ALPHA })
    .poly(heap)
    .fill(OFFICE_COLOUR)
    .stroke({ color: OUTLINE_COLOUR, width: OUTLINE_WIDTH })
    .poly([16, 30, 28, 22, 32, 30, 20, 36])
    .poly([38, 26, 48, 30, 44, 38])
    .fill(DEFENSE_COLOUR)
    .stroke({ color: OUTLINE_COLOUR, width: 2 })
    .roundRect(10, 38, 30, 7, 2)
    .fill(WOOD_COLOUR)
    .stroke({ color: OUTLINE_COLOUR, width: 2 });
}
