import { Container, Graphics, Sprite } from "pixi.js";
import type { BattleState } from "../../battle/battle";
import type { BoardPoint, ShotEvent } from "../../battle/events";
import { tileKey } from "../../maze/board";
import { TILE_SIZE, type BoardTextures } from "./board-textures";
import { ATTACK_COLOUR, DEFENSE_COLOUR } from "./board-view";
import type { Turrets } from "./pieces-view";

/** How long a shot's tracer stays, in battle steps. */
const TRACER_STEPS = 10;
/** Interns are small; the soldier sprite fills most of a tile at full size. */
const DUDE_SCALE = 0.85;
/** The disc in the attack colour under each Dude, in tiles: the soldier sprite alone is too dark to pick out. */
const DUDE_DISC_RADIUS = 0.27;
/** Kenney's sprites face up; PixiJS measures rotation from the right. */
const SPRITE_FACING = Math.PI / 2;

/**
 * The battle as it stands: one sprite per Dude on a disc in the attack colour, shot tracers in the
 * defense colour, and tower turrets turned toward their last shot. It reads battle state only.
 */
export class UnitsView {
  readonly view = new Container({ label: "units" });
  private readonly discs = new Graphics({ label: "dude-discs" });
  private readonly dudeLayer = new Container({ label: "dudes" });
  private readonly tracers = new Graphics({ label: "tracers" });
  private readonly dudeSprites = new Map<number, Sprite>();
  private recentShots: ShotEvent[] = [];

  constructor(private readonly textures: BoardTextures) {
    this.view.addChild(this.discs, this.dudeLayer, this.tracers);
  }

  show(
    state: BattleState,
    newShots: readonly ShotEvent[],
    turrets: Turrets,
  ): void {
    this.drawDudes(state);
    this.recentShots = [...this.recentShots, ...newShots].filter(
      (shot) => state.step - shot.step < TRACER_STEPS,
    );
    this.drawTracers(state.step);
    for (const tower of state.towers) {
      const turret = turrets.get(tileKey(tower.tile));
      if (turret === undefined || tower.aimedAt === null) continue;
      turret.rotation = facing(
        { x: tower.tile.column + 0.5, y: tower.tile.row + 0.5 },
        tower.aimedAt,
        turret.rotation,
      );
    }
  }

  clear(): void {
    for (const sprite of this.dudeSprites.values()) sprite.destroy();
    this.dudeSprites.clear();
    this.recentShots = [];
    this.tracers.clear();
    this.discs.clear();
  }

  private drawDudes(state: BattleState): void {
    const alive = new Set<number>();
    this.discs.clear();
    for (const dude of state.dudes) {
      this.discs.circle(
        dude.x * TILE_SIZE,
        dude.y * TILE_SIZE,
        DUDE_DISC_RADIUS * TILE_SIZE,
      );
      alive.add(dude.id);
      let sprite = this.dudeSprites.get(dude.id);
      if (sprite === undefined) {
        sprite = new Sprite({
          texture: this.textures.dude,
          anchor: 0.5,
          scale: DUDE_SCALE,
          // Dudes enter walking right, off the Spawn line.
          rotation: SPRITE_FACING,
          x: dude.x * TILE_SIZE,
          y: dude.y * TILE_SIZE,
        });
        this.dudeSprites.set(dude.id, sprite);
        this.dudeLayer.addChild(sprite);
      }
      const previous = { x: sprite.x / TILE_SIZE, y: sprite.y / TILE_SIZE };
      sprite.rotation = facing(previous, dude, sprite.rotation);
      sprite.position.set(dude.x * TILE_SIZE, dude.y * TILE_SIZE);
    }
    this.discs
      .fill({ color: ATTACK_COLOUR })
      .stroke({ color: 0xffffff, alpha: 0.7, width: 2 });
    for (const [id, sprite] of this.dudeSprites) {
      if (alive.has(id)) continue;
      sprite.destroy();
      this.dudeSprites.delete(id);
    }
  }

  private drawTracers(step: number): void {
    this.tracers.clear();
    for (const shot of this.recentShots) {
      const fade = 1 - (step - shot.step) / TRACER_STEPS;
      this.tracers
        .moveTo(
          (shot.pieceTile.column + 0.5) * TILE_SIZE,
          (shot.pieceTile.row + 0.5) * TILE_SIZE,
        )
        .lineTo(shot.at.x * TILE_SIZE, shot.at.y * TILE_SIZE)
        .stroke({
          color: DEFENSE_COLOUR,
          alpha: 0.9 * fade,
          width: 4,
          cap: "round",
        });
    }
  }
}

/** The rotation that points a sprite from `from` to `to`; the old one when they are the same point. */
function facing(from: BoardPoint, to: BoardPoint, current: number): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return current;
  return Math.atan2(dy, dx) + SPRITE_FACING;
}
