import { Container, Sprite, type Texture } from "pixi.js";
import type { PieceId } from "../../catalog/pieces";
import { tileKey } from "../../maze/board";
import { placedPieces, type Maze } from "../../maze/maze";
import { TILE_SIZE, type BoardTextures } from "./board-textures";
import { LAMP } from "./tower-art";

/**
 * The part of each Piece that moves in battle, by the tile key of its Piece: a Sniper Nest's
 * barrel, a Turnstile's arms, a Lighthouse's beam, a Siren's ring, a Grinder's teeth.
 */
export type MovingParts = ReadonlyMap<string, MovingPart>;

export interface MovingPart {
  readonly pieceId: PieceId;
  readonly part: Container;
}

const MOVING_PART_LABEL = "moving-part";

/** One Piece, drawn in a tile-sized box with its top left at (0, 0); its moving part at rest. */
export function pieceView(
  textures: BoardTextures,
  pieceId: PieceId,
): Container {
  const piece = new Container({ label: pieceId });
  const body = new Sprite(textures.pieces[pieceId]);
  const centred = (texture: Texture) =>
    new Sprite({
      texture,
      label: MOVING_PART_LABEL,
      anchor: 0.5,
      position: { x: TILE_SIZE / 2, y: TILE_SIZE / 2 },
    });
  switch (pieceId) {
    case "sniper-nest":
      piece.addChild(body, centred(textures.sniperBarrel));
      break;
    case "grinder":
      piece.addChild(body, centred(textures.grinderTeeth));
      break;
    case "turnstile":
      // The arms reach into the tiles either side, under the post.
      piece.addChild(centred(textures.turnstileArms), body);
      break;
    case "lighthouse":
      // The beam goes out from the lamp, behind the tower.
      piece.addChild(
        new Sprite({
          texture: textures.lighthouseCone,
          label: MOVING_PART_LABEL,
          anchor: { x: 0, y: 0.5 },
          position: LAMP,
        }),
        body,
      );
      break;
    case "siren": {
      // Hidden until the battle view pulses it.
      const ring = centred(textures.sirenRing);
      ring.visible = false;
      piece.addChild(ring, body);
      break;
    }
    default:
      piece.addChild(body);
  }
  return piece;
}

/** Every Piece in the Maze. Redrawn whole: a Board holds at most a few hundred. */
export function drawPieces(
  layer: Container,
  textures: BoardTextures,
  maze: Maze,
): MovingParts {
  for (const child of layer.removeChildren()) child.destroy({ children: true });
  const parts = new Map<string, MovingPart>();
  for (const { pieceId, tile } of placedPieces(maze)) {
    const piece = pieceView(textures, pieceId);
    piece.position.set(tile.column * TILE_SIZE, tile.row * TILE_SIZE);
    layer.addChild(piece);
    const part = piece.getChildByLabel(MOVING_PART_LABEL);
    if (part !== null) parts.set(tileKey(tile), { pieceId, part });
  }
  return parts;
}
