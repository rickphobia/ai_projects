import { Rectangle, Sprite, type Container, type Renderer } from "pixi.js";
import { DUDE_KINDS, type DudeKindId } from "../../catalog/dudes";
import { PIECES, type PieceId } from "../../catalog/pieces";
import type { Portraits } from "../../ui/shop";
import { DUDE_FRAME } from "./dude-art";
import { TILE_SIZE, type BoardTextures } from "./board-textures";
import { pieceView } from "./pieces-view";

/** Shop pictures show at about 32 CSS px; this keeps them sharp on phone screens. */
const PORTRAIT_RESOLUTION = 2;

/**
 * Each Dude kind's calm face and each Piece at rest, as image URLs for the shop's buttons, taken
 * from the Board's own textures so the two match. Call once at start-up.
 */
export async function drawPortraits(
  renderer: Renderer,
  textures: BoardTextures,
): Promise<Portraits> {
  const portrait = async (target: Container, size: number): Promise<string> => {
    const url = await renderer.extract.base64({
      target,
      // A fixed frame, so a Lighthouse's beam can't stretch its picture past the tile.
      frame: new Rectangle(0, 0, size, size),
      resolution: PORTRAIT_RESOLUTION,
    });
    target.destroy();
    return url;
  };
  const dudeIds = Object.keys(DUDE_KINDS) as DudeKindId[];
  const pieceIds = Object.keys(PIECES) as PieceId[];
  const urls = await Promise.all([
    ...dudeIds.map((id) =>
      portrait(new Sprite(textures.dudes[id].calm), DUDE_FRAME),
    ),
    ...pieceIds.map((id) => portrait(pieceView(textures, id), TILE_SIZE)),
  ]);
  return Object.fromEntries(
    [...dudeIds, ...pieceIds].map((id, index) => [id, urls[index]]),
  ) as Portraits;
}
