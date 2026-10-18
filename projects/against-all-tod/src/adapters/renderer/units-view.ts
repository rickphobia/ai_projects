import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import { beamAngle } from "../../battle/area-effects";
import {
  STEPS_PER_SECOND,
  turnstilesTurned,
  type BattleState,
} from "../../battle/battle";
import type { DudeState } from "../../battle/dudes";
import type { BoardPoint, ShotEvent } from "../../battle/events";
import type { DudeKindId } from "../../catalog/dudes";
import { PIECES } from "../../catalog/pieces";
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
/**
 * Every kind shares the soldier sprite, so the disc under it tells them apart: Interns in the
 * plain attack colour, the rest in their own shades.
 */
const DISC_TINTS: Readonly<Record<DudeKindId, number>> = {
  intern: ATTACK_COLOUR,
  termite: 0xd9a066,
  "ram-crew": 0x7a4a2a,
  balloonist: 0x8be0ff,
  "shield-bro": 0xc0c0c0,
  "hype-man": 0xff4fd8,
  sapper: 0x4a4a4a,
  mole: 0x8b5a2b,
  streaker: 0xffe14f,
};
/** Balloonists float above the Maze, so they are drawn bigger. */
const FLYER_SCALE = 1.15;
/** A Ram Crew is four Dudes and a ram in one, so it is drawn bigger still. */
const RAM_CREW_SCALE = 1.5;
/** How see-through a Mole is while underground. */
const UNDERGROUND_ALPHA = 0.3;
/** How see-through a Shield Bro's disc is once his shield breaks. */
const BROKEN_SHIELD_ALPHA = 0.5;
/** Kenney's sprites face up; PixiJS measures rotation from the right. */
const SPRITE_FACING = Math.PI / 2;

/** The disc drawn once in white, to be made into the texture every Dude's disc sprite shares and tints. */
export function dudeDisc(): Graphics {
  const radius = DUDE_DISC_RADIUS * TILE_SIZE;
  return new Graphics()
    .circle(0, 0, radius)
    .fill({ color: 0xffffff })
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
    turnByClock(turrets, state.step);
    for (const tower of state.towers) {
      const turret = turrets.get(tileKey(tower.tile))?.turret;
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
        sprites = this.addDude(dude.kind, x, y);
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
      showState(sprites, dude);
      sprites.seenInFrame = this.frame;
    }
    for (const [id, sprites] of this.dudeSprites) {
      if (sprites.seenInFrame === this.frame) continue;
      destroy(sprites);
      this.dudeSprites.delete(id);
    }
  }

  private addDude(kind: DudeKindId, x: number, y: number): DudeSprites {
    const scale =
      kind === "balloonist"
        ? FLYER_SCALE
        : kind === "ram-crew"
          ? RAM_CREW_SCALE
          : 1;
    const disc = new Sprite({
      texture: this.discTexture,
      anchor: 0.5,
      scale,
      tint: DISC_TINTS[kind],
      x,
      y,
    });
    const body = new Sprite({
      texture: this.textures.dude,
      anchor: 0.5,
      scale: DUDE_SCALE * scale,
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

/** A Mole underground fades out; a Shield Bro's disc dims once his shield breaks. */
function showState({ disc, body }: DudeSprites, dude: DudeState): void {
  const alpha = dude.burrowTo === null ? 1 : UNDERGROUND_ALPHA;
  body.alpha = alpha;
  disc.alpha =
    dude.kind === "shield-bro" && dude.shield <= 0
      ? BROKEN_SHIELD_ALPHA
      : alpha;
}

function destroy({ disc, body }: DudeSprites): void {
  disc.destroy();
  body.destroy();
}

/** The rotation that points a sprite from (fromX, fromY) to `to`; the old one when they are the same point. */
/** Turns the Pieces that follow the battle clock: Lighthouse lamps along their beam, Turnstile arms. */
function turnByClock(turrets: Turrets, step: number): void {
  const turned = turnstilesTurned(step);
  for (const { pieceId, turret } of turrets.values()) {
    const beam = PIECES[pieceId].beam;
    if (beam !== null) {
      turret.rotation = beamAngle(beam, step, STEPS_PER_SECOND) + SPRITE_FACING;
    } else if (PIECES[pieceId].turnIntervalSeconds !== null) {
      turret.rotation = turned ? Math.PI / 2 : 0;
    }
  }
}

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
