import { Container, Graphics } from "pixi.js";
import type { Tile } from "../../maze/board";
import { TILE_SIZE } from "./board-textures";
import {
  DEFENSE_COLOUR,
  OUTLINE_COLOUR,
  OUTLINE_WIDTH,
  REFUSED_COLOUR,
} from "./board-view";

const FRAME_INSET = 4;
const FRAME_WIDTH = 4;
const FRAME_RADIUS = 10;
const CROSS_NEAR = TILE_SIZE * 0.3;
const CROSS_FAR = TILE_SIZE - CROSS_NEAR;

/**
 * The tile under the mouse: a faint ghost of the Piece or Squad where it may go, in a rounded
 * frame in its side's colour, and a red frame with a cross where it may not.
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
    const colour = allowed ? this.allowedColour : REFUSED_COLOUR;
    this.frame.clear();
    // Each line twice, a path per stroke: the dark outline, then the colour down its middle.
    for (const [lineColour, width] of [
      [OUTLINE_COLOUR, FRAME_WIDTH + 2 * OUTLINE_WIDTH],
      [colour, FRAME_WIDTH],
    ] as const) {
      this.frame
        .roundRect(
          FRAME_INSET,
          FRAME_INSET,
          TILE_SIZE - 2 * FRAME_INSET,
          TILE_SIZE - 2 * FRAME_INSET,
          FRAME_RADIUS,
        )
        .stroke({ color: lineColour, width });
      // A refused tile also gets a chunky cross.
      if (!allowed) {
        this.frame
          .moveTo(CROSS_NEAR, CROSS_NEAR)
          .lineTo(CROSS_FAR, CROSS_FAR)
          .moveTo(CROSS_FAR, CROSS_NEAR)
          .lineTo(CROSS_NEAR, CROSS_FAR)
          .stroke({ color: lineColour, width, cap: "round" });
      }
    }
  }
}
