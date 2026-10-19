import { Container, Sprite, type ColorSource } from "pixi.js";
import type { PieceId } from "../../catalog/pieces";
import { tileKey } from "../../maze/board";
import { placedPieces, type Maze } from "../../maze/maze";
import { TILE_SIZE, type BoardTextures } from "./board-textures";
import { DEFENSE_COLOUR } from "./board-view";

/** The part of a Piece that turns in battle (a turret, a lamp, a Turnstile's arms), by the tile key of its Piece. */
export type Turrets = ReadonlyMap<
  string,
  { readonly pieceId: PieceId; readonly turret: Container }
>;

const TURRET_LABEL = "turret";
/** The Lighthouse's lamp and the Siren's horn: the turret sprite in their own colours. */
const LIGHTHOUSE_COLOUR = 0xffe066;
const SIREN_COLOUR = 0xff5c8a;
/** Floor Pieces are a flat slab, see-through so they read as walkable. */
const TAX_BOOTH_COLOUR = 0x7dd87d;
const GRINDER_COLOUR = 0xb0b0b0;
const FLOOR_ALPHA = 0.7;
const FLOOR_SCALE = 0.8;
const BOUNCER_COLOUR = 0xff9f1c;
const DECOY_GOAL_COLOUR = 0xffd700;
/** A Turnstile arm is a crate shrunk to this share of a tile, so the arm reads as part of the Piece. */
const ARM_SCALE = 0.7;

/** One Piece, drawn in a tile-sized box with its top left at (0, 0). */
export function pieceView(
  textures: BoardTextures,
  pieceId: PieceId,
): Container {
  const piece = new Container({ label: pieceId });
  switch (pieceId) {
    case "crate-wall":
      piece.addChild(new Sprite(textures.crateWall));
      break;
    case "sniper-nest":
      piece.addChild(...towerSprites(textures, DEFENSE_COLOUR));
      break;
    case "lighthouse":
      piece.addChild(...towerSprites(textures, LIGHTHOUSE_COLOUR));
      break;
    case "siren":
      piece.addChild(...towerSprites(textures, SIREN_COLOUR));
      break;
    case "turnstile":
      piece.addChild(turnstileSprites(textures));
      break;
    case "tax-booth":
      piece.addChild(floorSprite(textures, TAX_BOOTH_COLOUR));
      break;
    case "grinder":
      piece.addChild(floorSprite(textures, GRINDER_COLOUR));
      break;
    case "bouncer":
      piece.addChild(
        new Sprite({ texture: textures.crateWall, tint: BOUNCER_COLOUR }),
      );
      break;
    case "decoy-goal":
      piece.addChild(
        new Sprite({ texture: textures.stoneBase, tint: DECOY_GOAL_COLOUR }),
      );
      break;
  }
  return piece;
}

function floorSprite(textures: BoardTextures, colour: ColorSource): Sprite {
  const slab = new Sprite({
    texture: textures.towerBase,
    anchor: 0.5,
    scale: FLOOR_SCALE,
    tint: colour,
    alpha: FLOOR_ALPHA,
  });
  slab.position.set(TILE_SIZE / 2, TILE_SIZE / 2);
  return slab;
}

function towerSprites(
  textures: BoardTextures,
  colour: ColorSource,
): [Sprite, Sprite] {
  const turret = new Sprite({
    texture: textures.turret,
    label: TURRET_LABEL,
    anchor: 0.5,
    tint: colour,
  });
  turret.position.set(TILE_SIZE / 2, TILE_SIZE / 2);
  return [new Sprite(textures.towerBase), turret];
}

/** The centre crate and an arm either side, unturned (left and right); the battle view turns them. */
function turnstileSprites(textures: BoardTextures): Container {
  const arms = new Container({ label: TURRET_LABEL });
  arms.position.set(TILE_SIZE / 2, TILE_SIZE / 2);
  for (const offset of [-1, 0, 1]) {
    const crate = new Sprite({
      texture: textures.crateWall,
      anchor: 0.5,
      scale: offset === 0 ? 1 : ARM_SCALE,
      tint: offset === 0 ? 0xffffff : DEFENSE_COLOUR,
    });
    crate.position.set(offset * TILE_SIZE, 0);
    arms.addChild(crate);
  }
  return arms;
}

/** Every Piece in the Maze. Redrawn whole: a Board holds at most a few hundred. */
export function drawPieces(
  layer: Container,
  textures: BoardTextures,
  maze: Maze,
): Turrets {
  for (const child of layer.removeChildren()) child.destroy({ children: true });
  const turrets = new Map<
    string,
    { readonly pieceId: PieceId; readonly turret: Container }
  >();
  for (const { pieceId, tile } of placedPieces(maze)) {
    const piece = pieceView(textures, pieceId);
    piece.position.set(tile.column * TILE_SIZE, tile.row * TILE_SIZE);
    layer.addChild(piece);
    const turret = piece.getChildByLabel(TURRET_LABEL);
    if (turret !== null) turrets.set(tileKey(tile), { pieceId, turret });
  }
  return turrets;
}
