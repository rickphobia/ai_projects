import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import type { Tile } from "../../maze/board";
import { TILE_SIZE } from "./board-textures";
import { DEFENSE_COLOUR, REFUSED_COLOUR } from "./board-view";

/** The tile under the mouse: a faint ghost of the Piece where it may go, a red frame where it may not. */
export class PlacementCursor {
  readonly view = new Container({ label: "placement-cursor" });
  private readonly ghost: Sprite;
  private readonly frame = new Graphics();

  constructor(pieceTexture: Texture) {
    this.ghost = new Sprite(pieceTexture);
    this.ghost.alpha = 0.5;
    this.view.addChild(this.ghost, this.frame);
    this.view.visible = false;
  }

  show(tile: Tile | null, allowed: boolean): void {
    this.view.visible = tile !== null;
    if (tile === null) return;
    this.view.position.set(tile.column * TILE_SIZE, tile.row * TILE_SIZE);
    this.ghost.visible = allowed;
    this.frame
      .clear()
      .rect(2, 2, TILE_SIZE - 4, TILE_SIZE - 4)
      .stroke({ color: allowed ? DEFENSE_COLOUR : REFUSED_COLOUR, width: 4 });
  }
}
