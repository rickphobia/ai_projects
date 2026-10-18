import { Container, Graphics } from "pixi.js";
import type { Tile } from "../../maze/board";
import { TILE_SIZE } from "./board-textures";
import { DEFENSE_COLOUR, REFUSED_COLOUR } from "./board-view";

/**
 * The tile under the mouse: a faint ghost of the Piece or Squad where it may go, framed in its
 * side's colour, and a red frame where it may not.
 */
export class PlacementCursor {
  readonly view = new Container({ label: "placement-cursor" });
  private ghost: Container;
  private allowedColour = DEFENSE_COLOUR;
  private readonly frame = new Graphics();

  constructor(ghost: Container) {
    this.ghost = ghost;
    this.ghost.alpha = 0.5;
    this.view.addChild(this.ghost, this.frame);
    this.view.visible = false;
  }

  /** Swaps the ghost when the player picks another Piece or Dude kind. */
  setGhost(ghost: Container, allowedColour: number): void {
    this.allowedColour = allowedColour;
    this.ghost.destroy({ children: true });
    this.ghost = ghost;
    this.ghost.alpha = 0.5;
    this.view.addChildAt(this.ghost, 0);
  }

  show(tile: Tile | null, allowed: boolean): void {
    this.view.visible = tile !== null;
    if (tile === null) return;
    this.view.position.set(tile.column * TILE_SIZE, tile.row * TILE_SIZE);
    this.ghost.visible = allowed;
    this.frame
      .clear()
      .rect(2, 2, TILE_SIZE - 4, TILE_SIZE - 4)
      .stroke({
        color: allowed ? this.allowedColour : REFUSED_COLOUR,
        width: 4,
      });
  }
}
