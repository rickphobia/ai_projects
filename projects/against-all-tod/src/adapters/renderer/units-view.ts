import { Container, Graphics, Sprite, type Texture } from "pixi.js";
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

/** The disc drawn once, to be made into the texture every Dude's disc sprite shares. */
export function dudeDisc(): Graphics {
  const radius = DUDE_DISC_RADIUS * TILE_SIZE;
  return new Graphics()
    .circle(0, 0, radius)
    .fill({ color: ATTACK_COLOUR })
    .stroke({ color: 0xffffff, alpha: 0.7, width: 2 });
}

/** One Dude on screen: its disc, its body, and the frame it was last seen in. */
interface DudeSprites {
  readonly disc: Sprite;
  readonly body: Sprite;
  seenInFrame: number;
}

/**
 * The battle as it stands: one sprite per Dude on a disc sprite in the attack colour, shot tracers
 * in the defense colour, and tower turrets turned toward their last shot. It reads battle state only.
 *
 * Every Dude is two sprites sharing two textures, so PixiJS draws the whole swarm in a batch or
 * two; a frame moves sprites and allocates nothing per Dude.
 */
export class UnitsView {
  readonly view = new Container({ label: "units" });
  private readonly discLayer = new Container({ label: "dude-discs" });
  private readonly dudeLayer = new Container({ label: "dudes" });
  private readonly tracers = new Graphics({ label: "tracers" });
  private readonly dudeSprites = new Map<number, DudeSprites>();
  private recentShots: ShotEvent[] = [];
  private frame = 0;

  constructor(
    private readonly textures: BoardTextures,
    private readonly discTexture: Texture,
  ) {
    this.view.addChild(this.discLayer, this.dudeLayer, this.tracers);
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
        tower.tile.column + 0.5,
        tower.tile.row + 0.5,
        tower.aimedAt,
        turret.rotation,
      );
    }
  }

  clear(): void {
    for (const sprites of this.dudeSprites.values()) destroy(sprites);
    this.dudeSprites.clear();
    this.recentShots = [];
    this.tracers.clear();
  }

  private drawDudes(state: BattleState): void {
    this.frame++;
    for (const dude of state.dudes) {
      const x = dude.x * TILE_SIZE;
      const y = dude.y * TILE_SIZE;
      let sprites = this.dudeSprites.get(dude.id);
      if (sprites === undefined) {
        sprites = this.addDude(x, y);
        this.dudeSprites.set(dude.id, sprites);
      }
      const { disc, body } = sprites;
      body.rotation = facing(
        body.x / TILE_SIZE,
        body.y / TILE_SIZE,
        dude,
        body.rotation,
      );
      body.position.set(x, y);
      disc.position.set(x, y);
      sprites.seenInFrame = this.frame;
    }
    for (const [id, sprites] of this.dudeSprites) {
      if (sprites.seenInFrame === this.frame) continue;
      destroy(sprites);
      this.dudeSprites.delete(id);
    }
  }

  private addDude(x: number, y: number): DudeSprites {
    const disc = new Sprite({ texture: this.discTexture, anchor: 0.5, x, y });
    const body = new Sprite({
      texture: this.textures.dude,
      anchor: 0.5,
      scale: DUDE_SCALE,
      // Dudes enter walking right, off the Spawn line.
      rotation: SPRITE_FACING,
      x,
      y,
    });
    this.discLayer.addChild(disc);
    this.dudeLayer.addChild(body);
    return { disc, body, seenInFrame: this.frame };
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

function destroy({ disc, body }: DudeSprites): void {
  disc.destroy();
  body.destroy();
}

/** The rotation that points a sprite from (fromX, fromY) to `to`; the old one when they are the same point. */
function facing(
  fromX: number,
  fromY: number,
  to: BoardPoint,
  current: number,
): number {
  const dx = to.x - fromX;
  const dy = to.y - fromY;
  if (dx === 0 && dy === 0) return current;
  return Math.atan2(dy, dx) + SPRITE_FACING;
}
