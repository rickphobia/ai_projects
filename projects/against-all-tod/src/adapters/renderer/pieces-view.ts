import { Container, Sprite } from "pixi.js";
import type { PieceId } from "../../catalog/pieces";
import { tileKey } from "../../maze/board";
import { placedPieces, type Maze } from "../../maze/maze";
import { TILE_SIZE, type BoardTextures } from "./board-textures";
import { DEFENSE_COLOUR } from "./board-view";

/** A tower Piece's turret, by the tile key of its Piece, so the battle view can turn it. */
export type Turrets = ReadonlyMap<string, Sprite>;

const TURRET_LABEL = "turret";

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
    case "sniper-nest": {
      const turret = new Sprite({
        texture: textures.turret,
        label: TURRET_LABEL,
        anchor: 0.5,
        tint: DEFENSE_COLOUR,
      });
      turret.position.set(TILE_SIZE / 2, TILE_SIZE / 2);
      piece.addChild(new Sprite(textures.towerBase), turret);
      break;
    }
  }
  return piece;
}

/** Every Piece in the Maze. Redrawn whole: a Board holds at most a few hundred. */
export function drawPieces(
  layer: Container,
  textures: BoardTextures,
  maze: Maze,
): Turrets {
  for (const child of layer.removeChildren()) child.destroy({ children: true });
  const turrets = new Map<string, Sprite>();
  for (const { pieceId, tile } of placedPieces(maze)) {
    const piece = pieceView(textures, pieceId);
    piece.position.set(tile.column * TILE_SIZE, tile.row * TILE_SIZE);
    layer.addChild(piece);
    const turret = piece.getChildByLabel(TURRET_LABEL);
    if (turret instanceof Sprite) turrets.set(tileKey(tile), turret);
  }
  return turrets;
}
