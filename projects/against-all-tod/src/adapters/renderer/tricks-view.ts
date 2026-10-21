import { Container, Graphics, Text } from "pixi.js";
import { litTiles } from "../../battle/area-effects";
import { allTiles, tileKey, tileKind } from "../../maze/board";
import { placedPieces, type Maze } from "../../maze/maze";
import type { SliderPositions } from "../../tricks/tricks";
import { TILE_SIZE } from "./board-textures";
import {
  BOARD_SURROUND,
  boardPixelFrame,
  DARK_COLOUR,
  DEFENSE_COLOUR,
  LIGHT_WASH_COLOUR,
  TEXT_COLOUR,
  worldRect,
} from "./board-view";

/** How dark each Brightness step down makes an unlit tile. */
const DARK_ALPHA_PER_STEP = 0.36;
/** How strong the wash is per Brightness step up. */
const BRIGHT_ALPHA_PER_STEP = 0.1;
const OUTLINE_WIDTH = 3;
const OUTLINE_ALPHA = 0.9;
const OUTLINE_CORNER_RADIUS = 6;

/**
 * The tricks on the Board, so their state shows there and not only in the Settings menu: the dark
 * over every tile no Lighthouse lights (with each Piece outlined in the defense colour so it stays
 * readable), a light wash when bright, and a Game speed badge. It sits under the Dudes, which
 * keep their own glow. It reads state; it never changes rules.
 */
export class TricksView {
  readonly view = new Container({ label: "tricks" });
  private readonly shade = new Graphics({ label: "tricks-shade" });
  private readonly speedBadge = new Text({
    text: "",
    style: { fill: TEXT_COLOUR, fontSize: 22, fontWeight: "bold" },
  });
  private sliders: SliderPositions | null = null;
  private maze: Maze | null = null;

  constructor() {
    this.view.addChild(this.shade, this.speedBadge);
  }

  /** Whether units should glow: only in the dark. */
  get dark(): boolean {
    return (this.sliders?.brightness ?? 0) < 0;
  }

  show(sliders: SliderPositions, maze: Maze): void {
    if (sliders === this.sliders && maze === this.maze) return;
    this.sliders = sliders;
    this.maze = maze;
    this.shade.clear();
    const frame = boardPixelFrame(maze.windowSize);
    this.speedBadge.position.set(
      TILE_SIZE * 0.25,
      frame.top + TILE_SIZE * 0.15,
    );
    const brightness = sliders.brightness;
    if (brightness < 0) this.drawDark(maze, -brightness);
    if (brightness > 0) {
      const world = worldRect(maze.windowSize);
      this.shade.rect(world.left, world.top, world.width, world.height).fill({
        color: LIGHT_WASH_COLOUR,
        alpha: BRIGHT_ALPHA_PER_STEP * brightness,
      });
    }
    const speed = sliders["game-speed"];
    this.speedBadge.text =
      speed === 0 ? "" : `Game speed ${speed > 0 ? "+" : ""}${String(speed)}`;
  }

  private drawDark(maze: Maze, steps: number): void {
    const lit = litTiles(maze);
    // The world round the Board goes dark too; closed Spawn zone tiles are part of it. The ring
    // reaches a tile past the surround, so tree crowns hanging over its edge darken with it.
    const frame = boardPixelFrame(maze.windowSize);
    const outside = BOARD_SURROUND + TILE_SIZE;
    const bottom = frame.top + frame.height;
    this.shade
      .rect(-outside, frame.top - outside, frame.width + 2 * outside, outside)
      .rect(-outside, bottom, frame.width + 2 * outside, outside)
      .rect(-outside, frame.top, outside, frame.height)
      .rect(frame.width, frame.top, outside, frame.height);
    for (const tile of allTiles(maze.windowSize)) {
      const closed = tileKind(tile, maze.windowSize) === "closed";
      if (lit.has(tileKey(tile)) && !closed) continue;
      this.shade.rect(
        tile.column * TILE_SIZE,
        tile.row * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE,
      );
    }
    this.shade.fill({ color: DARK_COLOUR, alpha: DARK_ALPHA_PER_STEP * steps });
    const inset = OUTLINE_WIDTH;
    for (const { tile } of placedPieces(maze)) {
      this.shade.roundRect(
        tile.column * TILE_SIZE + inset,
        tile.row * TILE_SIZE + inset,
        TILE_SIZE - 2 * inset,
        TILE_SIZE - 2 * inset,
        OUTLINE_CORNER_RADIUS,
      );
    }
    this.shade.stroke({
      color: DEFENSE_COLOUR,
      width: OUTLINE_WIDTH,
      alpha: OUTLINE_ALPHA,
    });
  }
}
