import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import type { BattleState } from "../../battle/battle";
import type { DudeState } from "../../battle/dudes";
import type { ShotEvent } from "../../battle/events";
import { BOARD_COLUMNS } from "../../maze/board";
import { TILE_SIZE, type BoardTextures } from "./board-textures";
import { ATTACK_COLOUR, DEFENSE_COLOUR } from "./board-view";
import { dudeScale } from "./dude-scale";
import { PANIC_STEPS, flop, waddle, type Waddle } from "./dude-motion";
import type { Turrets } from "./pieces-view";
import { aimTurrets } from "./turret-aim";

/** How long a shot's tracer stays, in battle steps. */
const TRACER_STEPS = 10;
/** How see-through a Ghost Mode ghost is. */
const GHOST_ALPHA = 0.35;
/** How see-through an older Dude is while the eraser is chosen: Erasing it refunds nothing. */
const DIMMED_ALPHA = 0.35;
/** How see-through a Mole is while underground. */
const UNDERGROUND_ALPHA = 0.3;
/** In the dark each Dude glows: a soft halo in the attack colour this much wider than its drawing. */
const HALO_SCALE = 1.2;
const HALO_ALPHA = 0.7;
/**
 * A Dude that vanishes this close to the Board's right edge reached the Goal rather than died,
 * so it just goes instead of flopping over. In tiles.
 */
const REACHED_GOAL_TILES = 1.5;
const STILL: Waddle = { tilt: 0, bob: 0 };

/** One Dude on screen: its glow, body and Mutation marks, and what the last frame saw of it. */
interface DudeSprites {
  readonly halo: Sprite;
  readonly body: Sprite;
  /** Laid over the body and moved with it; most Dudes have none, so the swarm stays cheap. */
  readonly grin: Sprite | null;
  readonly hands: Sprite | null;
  /** Explosive Shields' fuse, hidden once the small shield is gone. */
  readonly fuse: Sprite | null;
  /** Its size before facing: the body's x scale is this, negated while it walks left. */
  readonly scale: number;
  x: number;
  y: number;
  /** Health plus shields when last seen; a drop means it was hit. */
  toughness: number;
  /** It looks panicked until this battle step. */
  panicUntilStep: number;
  facingLeft: boolean;
  seenInFrame: number;
}

/** A Dude killed in battle, flopping over and fading from the step it died. */
interface FallenDude {
  readonly sprites: DudeSprites;
  readonly diedAtStep: number;
}

/**
 * The battle as it stands: one drawn Dude per Dude, with a glow under it in the dark, shot
 * tracers in the defense colour, and tower turrets turned toward their last shot. It reads
 * battle state only; waddling, panicking and flopping come from the Dude's id and the battle
 * step (`dude-motion.ts`), so they never change the battle.
 *
 * Every Dude is two sprites from the art kit's shared textures, so PixiJS draws the whole swarm
 * in a batch or two; a frame only moves sprites and swaps their textures, never redraws.
 */
export class UnitsView {
  readonly view = new Container({ label: "units" });
  /** Shown only in the dark (Brightness down), so Dudes keep a glowing outline. */
  private readonly haloLayer = new Container({
    label: "dude-halos",
    visible: false,
  });
  private readonly dudeLayer = new Container({ label: "dudes" });
  private readonly tracers = new Graphics({ label: "tracers" });
  private readonly dudeSprites = new Map<number, DudeSprites>();
  private fallen: FallenDude[] = [];
  private recentShots: ShotEvent[] = [];
  private frame = 0;
  /** Gold Teeth is on for the battle being shown. */
  private goldTeeth = false;

  constructor(private readonly textures: BoardTextures) {
    this.view.addChild(this.haloLayer, this.dudeLayer, this.tracers);
  }

  /** Turns the Dudes' glow on in the dark and off again. */
  glow(on: boolean): void {
    this.haloLayer.visible = on;
  }

  show(
    state: BattleState,
    newShots: readonly ShotEvent[],
    turrets: Turrets,
  ): void {
    this.goldTeeth = state.mutations.includes("gold-teeth");
    this.drawDudes(state.dudes, state.ghosts, state.step);
    this.recentShots = [...this.recentShots, ...newShots].filter(
      (shot) => state.step - shot.step < TRACER_STEPS,
    );
    this.drawTracers(state.step);
    aimTurrets(turrets, state);
  }

  /**
   * The Army standing where it was painted, while building; no battle is running, so nobody
   * waddles. Dudes whose ids are in `dimmed` are faded, so the eraser shows which ones refund.
   */
  showStanding(
    dudes: readonly DudeState[],
    dimmed: ReadonlySet<number> = new Set(),
  ): void {
    this.goldTeeth = false;
    this.drawDudes(dudes, [], null);
    for (const id of dimmed) {
      const sprites = this.dudeSprites.get(id);
      if (sprites === undefined) continue;
      sprites.body.alpha = DIMMED_ALPHA;
      sprites.halo.alpha = HALO_ALPHA * DIMMED_ALPHA;
    }
  }

  clear(): void {
    for (const sprites of this.dudeSprites.values()) destroy(sprites);
    this.dudeSprites.clear();
    for (const { sprites } of this.fallen) destroy(sprites);
    this.fallen = [];
    this.recentShots = [];
    this.tracers.clear();
  }

  /** `step` is the battle step, or null while building. */
  private drawDudes(
    dudes: readonly DudeState[],
    ghosts: BattleState["ghosts"],
    step: number | null,
  ): void {
    this.frame++;
    for (const dude of dudes) this.drawDude(dude, false, step);
    for (const { dude } of ghosts) this.drawDude(dude, true, step);
    for (const [id, sprites] of this.dudeSprites) {
      if (sprites.seenInFrame === this.frame) continue;
      this.dudeSprites.delete(id);
      const reachedGoal =
        sprites.x >= (BOARD_COLUMNS - REACHED_GOAL_TILES) * TILE_SIZE;
      if (step === null || reachedGoal) destroy(sprites);
      else this.fallen.push({ sprites, diedAtStep: step });
    }
    this.drawFallen(step);
  }

  /** A ghost keeps the sprite it had alive, as it has the same id. */
  private drawDude(dude: DudeState, ghost: boolean, step: number | null): void {
    const x = dude.x * TILE_SIZE;
    const y = dude.y * TILE_SIZE;
    const toughness = dude.health + dude.shield + (dude.smallShield ?? 0);
    let sprites = this.dudeSprites.get(dude.id);
    if (sprites === undefined) {
      sprites = this.addDude(dude, x, y, toughness);
      this.dudeSprites.set(dude.id, sprites);
    }
    const { halo, body } = sprites;
    const moved = x !== sprites.x || y !== sprites.y;
    if (x !== sprites.x) sprites.facingLeft = x < sprites.x;
    if (step !== null && toughness < sprites.toughness) {
      sprites.panicUntilStep = step + PANIC_STEPS;
    }
    sprites.x = x;
    sprites.y = y;
    sprites.toughness = toughness;
    const rocking = step !== null && moved ? waddle(dude.id, step) : STILL;
    body.position.set(x, y - rocking.bob);
    body.rotation = sprites.facingLeft ? -rocking.tilt : rocking.tilt;
    body.scale.x = sprites.facingLeft ? -sprites.scale : sprites.scale;
    halo.position.set(x, y);
    const faces =
      dude.kind === "shield-bro" && dude.shield <= 0
        ? this.textures.shieldBroUnshielded
        : this.textures.dudes[dude.kind];
    body.texture =
      step !== null && step < sprites.panicUntilStep
        ? faces.panicked
        : faces.calm;
    const alpha = ghost
      ? GHOST_ALPHA
      : dude.burrowTo === null
        ? 1
        : UNDERGROUND_ALPHA;
    body.alpha = alpha;
    halo.alpha = HALO_ALPHA * alpha;
    if (sprites.fuse !== null)
      sprites.fuse.visible = (dude.smallShield ?? 0) > 0;
    for (const mark of marksOf(sprites)) {
      mark.position.copyFrom(body.position);
      mark.rotation = body.rotation;
      mark.scale.x = body.scale.x;
      mark.alpha = alpha;
    }
    sprites.seenInFrame = this.frame;
  }

  private addDude(
    dude: DudeState,
    x: number,
    y: number,
    toughness: number,
  ): DudeSprites {
    const { kind } = dude;
    const scale = dudeScale(kind, dude.giant, dude.half);
    const halo = new Sprite({
      texture: this.textures.dudeGlow,
      anchor: 0.5,
      scale: scale * HALO_SCALE,
      tint: ATTACK_COLOUR,
      alpha: HALO_ALPHA,
      x,
      y,
    });
    const body = new Sprite({
      texture: this.textures.dudes[kind].calm,
      anchor: 0.5,
      scale,
      x,
      y,
    });
    this.haloLayer.addChild(halo);
    this.dudeLayer.addChild(body);
    const mark = (texture: Texture): Sprite =>
      this.dudeLayer.addChild(
        new Sprite({ texture, anchor: 0.5, scale, x, y }),
      );
    return {
      halo,
      body,
      grin: this.goldTeeth ? mark(this.textures.dudes[kind].goldGrin) : null,
      hands:
        dude.congaStroke === undefined ? null : mark(this.textures.congaHands),
      fuse: (dude.smallShield ?? 0) > 0 ? mark(this.textures.fuse) : null,
      scale,
      x,
      y,
      toughness,
      panicUntilStep: 0,
      facingLeft: false,
      seenInFrame: this.frame,
    };
  }

  /** Tips each fallen Dude over the way it was walking and fades it; gone once it has faded. */
  private drawFallen(step: number | null): void {
    this.fallen = this.fallen.filter(({ sprites, diedAtStep }) => {
      const now = step === null ? null : flop(step - diedAtStep);
      if (now === null) {
        destroy(sprites);
        return false;
      }
      const { body, halo } = sprites;
      const turn = (now.turn * Math.PI) / 2;
      body.rotation = sprites.facingLeft ? -turn : turn;
      body.position.set(sprites.x, sprites.y);
      body.alpha = now.alpha;
      halo.alpha = HALO_ALPHA * now.alpha;
      for (const mark of marksOf(sprites)) {
        mark.rotation = body.rotation;
        mark.position.copyFrom(body.position);
        mark.alpha = now.alpha;
      }
      return true;
    });
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

function marksOf({ grin, hands, fuse }: DudeSprites): Sprite[] {
  return [grin, hands, fuse].filter((mark): mark is Sprite => mark !== null);
}

function destroy(sprites: DudeSprites): void {
  sprites.halo.destroy();
  sprites.body.destroy();
  for (const mark of marksOf(sprites)) mark.destroy();
}
