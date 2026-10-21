import { Graphics } from "pixi.js";
import { goalTiles } from "../../maze/board";
import { TILE_SIZE } from "./board-textures";
import { ATTACK_COLOUR, DEFENSE_COLOUR, OUTLINE_COLOUR } from "./board-view";

const BAR_HEIGHT = 12;
/** The Goal sits on the right edge, so the bar reaches left from it to stay on the Board. */
const BAR_WIDTH = 1.8 * TILE_SIZE;

/** The Goal's health bar, just above the Goal: defense colour for what is left, attack colour for what is lost. */
export class GoalHealthBar {
  readonly view = new Graphics({ label: "goal-health" });
  private readonly right: number;
  private readonly top: number;

  constructor() {
    const tiles = goalTiles();
    this.right =
      (Math.max(...tiles.map((tile) => tile.column)) + 1) * TILE_SIZE - 4;
    this.top =
      Math.min(...tiles.map((tile) => tile.row)) * TILE_SIZE - BAR_HEIGHT - 6;
  }

  show(health: number, maxHealth: number): void {
    const left = this.right - BAR_WIDTH;
    const share =
      maxHealth > 0 ? Math.max(0, Math.min(1, health / maxHealth)) : 0;
    this.view
      .clear()
      .roundRect(left - 2, this.top - 2, BAR_WIDTH + 4, BAR_HEIGHT + 4, 4)
      .fill(OUTLINE_COLOUR)
      .rect(left, this.top, BAR_WIDTH, BAR_HEIGHT)
      .fill({ color: ATTACK_COLOUR, alpha: 0.7 });
    if (share > 0) {
      this.view
        .rect(left, this.top, BAR_WIDTH * share, BAR_HEIGHT)
        .fill(DEFENSE_COLOUR);
    }
  }
}
