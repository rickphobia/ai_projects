import { Container, Sprite, type Texture } from "pixi.js";
import type { PieceId } from "../../catalog/pieces";
import { placedPieces, type Maze } from "../../maze/maze";
import { TILE_SIZE, type BoardTextures } from "./board-textures";

export function pieceTexture(
  textures: BoardTextures,
  pieceId: PieceId,
): Texture {
  const byPiece: Record<PieceId, Texture> = {
    "crate-wall": textures.crateWall,
  };
  return byPiece[pieceId];
}

/** Every Piece in the Maze, one sprite per tile. Redrawn whole: a Board holds at most a few hundred. */
export function drawPieces(
  layer: Container,
  textures: BoardTextures,
  maze: Maze,
): void {
  for (const child of layer.removeChildren()) child.destroy();
  for (const { pieceId, tile } of placedPieces(maze)) {
    const sprite = new Sprite(pieceTexture(textures, pieceId));
    sprite.position.set(tile.column * TILE_SIZE, tile.row * TILE_SIZE);
    layer.addChild(sprite);
  }
}
