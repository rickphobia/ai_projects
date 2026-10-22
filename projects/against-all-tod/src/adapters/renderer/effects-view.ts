import {
  BitmapFont,
  BitmapText,
  Container,
  Sprite,
  type Texture,
} from "pixi.js";
import type { BattleState } from "../../battle/battle";
import type { BoardPoint, ShotEvent } from "../../battle/events";
import { goalTiles, type Tile } from "../../maze/board";
import type { Maze } from "../../maze/maze";
import { TILE_SIZE } from "./board-textures";
import { BLOOM_COLOUR, OUTLINE_COLOUR } from "./board-view";
import { COIN_SIZE, type EffectTextures } from "./effect-art";
import {
  BONK_GAP_MS,
  bulletProgress,
  burstPose,
  goldPose,
} from "./effect-motion";

const GOLD_FONT = "gold-pop";
/** Big enough to read at fit-to-window zoom on a phone. */
const GOLD_FONT_SIZE = 30;
/** Where on each of its tiles the Goal throws up a puff as it falls, in tiles from the tile's corner. */
const RUBBLE_PUFFS: readonly BoardPoint[] = [
  { x: 0.3, y: 0.4 },
  { x: 0.7, y: 0.6 },
];

/** A pooled sprite flying or bursting, and how old it is. */
interface Flying {
  readonly sprite: Sprite;
  readonly from: BoardPoint;
  readonly to: BoardPoint;
  ageMs: number;
}

interface Burst {
  readonly sprite: Sprite;
  ageMs: number;
}

interface GoldPop {
  readonly coin: Sprite;
  readonly label: BitmapText;
  readonly x: number;
  readonly y: number;
  ageMs: number;
}

/**
 * The battle's effects, all from the art kit's shared textures in pooled sprites: a bullet from
 * each Sniper Nest shot, a star puff where it lands, a bonk where a Wall-breaker hits a Piece,
 * "+Xg" gold pops and the Goal's rubble. They age in real time, so they play out the same at any
 * Game speed. The Lighthouse's light beam and the Siren's sound rings are the Pieces' own moving
 * parts (`piece-motion.ts`). It reads battle state only, so effects never change the battle.
 */
export class EffectsView {
  readonly view = new Container({ label: "effects" });
  private readonly bursts = new Container({ label: "bursts" });
  private readonly golds = new Container({ label: "gold-pops" });
  private readonly rubble: Sprite;
  private readonly freeSprites: Sprite[] = [];
  private readonly freeLabels: BitmapText[] = [];
  private flying: Flying[] = [];
  private bursting: Burst[] = [];
  private goldPops: GoldPop[] = [];
  /** The Pieces' health and the Maze the last battle frame showed, to spot new Wall-breaker hits. */
  private pieceHealth: ReadonlyMap<string, number> = new Map();
  private maze: Maze | null = null;
  private readonly lastBonkMs = new Map<string, number>();
  private clockMs = 0;
  private fontReady = false;

  constructor(private readonly textures: EffectTextures) {
    const goal = goalTiles();
    const bottom = Math.max(...goal.map((tile) => tile.row)) + 1;
    this.rubble = new Sprite({
      texture: textures.rubble,
      label: "rubble",
      anchor: { x: 0, y: 1 },
      x: Math.min(...goal.map((tile) => tile.column)) * TILE_SIZE,
      y: bottom * TILE_SIZE,
      visible: false,
    });
    this.view.addChild(this.rubble, this.bursts, this.golds);
  }

  /** Starts a bullet for each new shot, and a bonk at each Piece a Wall-breaker hit since the last frame. */
  showBattle(
    state: Pick<BattleState, "pieceHealth" | "maze">,
    newShots: readonly ShotEvent[],
  ): void {
    for (const shot of newShots) {
      this.flying.push({
        sprite: this.sprite(this.textures.bullet),
        from: centreOf(shot.pieceTile),
        to: shot.at,
        ageMs: 0,
      });
    }
    for (const [key, health] of state.pieceHealth) {
      if (health < (this.pieceHealth.get(key) ?? Infinity)) {
        const piece = state.maze.pieces.get(key);
        if (piece !== undefined) this.bonk(key, piece.tile);
      }
    }
    if (this.maze !== null && this.maze !== state.maze) {
      for (const [key, piece] of this.maze.pieces) {
        if (!state.maze.pieces.has(key)) this.bonk(key, piece.tile, true);
      }
    }
    this.pieceHealth = state.pieceHealth;
    this.maze = state.maze;
  }

  /** A coin and "+Xg" rising from `at`, where `amount` gold was earned or refunded. */
  popGold(at: BoardPoint, amount: number): void {
    if (amount <= 0) return;
    this.installFont();
    const x = at.x * TILE_SIZE;
    const y = at.y * TILE_SIZE;
    const label = this.freeLabels.pop() ?? this.newLabel();
    label.text = `+${String(amount)}g`;
    label.visible = true;
    const coin = this.sprite(this.textures.coin, this.golds);
    this.golds.addChild(label);
    const pop: GoldPop = { coin, label, x, y, ageMs: 0 };
    this.placeGold(pop);
    this.goldPops.push(pop);
  }

  /** The Goal's office falls into rubble in a cloud of puffs. */
  breakGoal(): void {
    this.rubble.visible = true;
    for (const tile of goalTiles()) {
      for (const puff of RUBBLE_PUFFS) {
        this.burst(this.textures.starPuff, {
          x: tile.column + puff.x,
          y: tile.row + puff.y,
        });
      }
    }
  }

  /** Moves every effect on by `elapsedMs`, handing each sprite back to the pool once it is done. */
  tick(elapsedMs: number): void {
    this.clockMs += elapsedMs;
    const landed: BoardPoint[] = [];
    this.flying = this.flying.filter((bullet) => {
      bullet.ageMs += elapsedMs;
      const progress = bulletProgress(bullet.ageMs);
      if (progress === null) {
        this.release(bullet.sprite);
        landed.push(bullet.to);
        return false;
      }
      const { from, to } = bullet;
      bullet.sprite.position.set(
        (from.x + (to.x - from.x) * progress) * TILE_SIZE,
        (from.y + (to.y - from.y) * progress) * TILE_SIZE,
      );
      bullet.sprite.rotation = Math.atan2(to.y - from.y, to.x - from.x);
      return true;
    });
    this.bursting = this.bursting.filter((burst) => {
      burst.ageMs += elapsedMs;
      const pose = burstPose(burst.ageMs);
      if (pose === null) {
        this.release(burst.sprite);
        return false;
      }
      burst.sprite.scale.set(pose.scale);
      burst.sprite.alpha = pose.alpha;
      return true;
    });
    for (const at of landed) this.burst(this.textures.starPuff, at);
    this.goldPops = this.goldPops.filter((pop) => {
      pop.ageMs += elapsedMs;
      if (this.placeGold(pop)) return true;
      this.release(pop.coin);
      pop.label.visible = false;
      this.freeLabels.push(pop.label);
      return false;
    });
  }

  /** Ends every effect and clears the rubble, ready for the Board while building. */
  clear(): void {
    for (const { sprite } of [...this.flying, ...this.bursting]) {
      this.release(sprite);
    }
    for (const pop of this.goldPops) {
      this.release(pop.coin);
      pop.label.visible = false;
      this.freeLabels.push(pop.label);
    }
    this.flying = [];
    this.bursting = [];
    this.goldPops = [];
    this.pieceHealth = new Map();
    this.maze = null;
    this.lastBonkMs.clear();
    this.rubble.visible = false;
  }

  /** A bonk at most every `BONK_GAP_MS` per Piece, as a Termite chews every step; always when it falls. */
  private bonk(key: string, tile: Tile, destroyed = false): void {
    const last = this.lastBonkMs.get(key);
    if (!destroyed && last !== undefined && this.clockMs - last < BONK_GAP_MS)
      return;
    this.lastBonkMs.set(key, this.clockMs);
    this.burst(this.textures.bonk, centreOf(tile));
  }

  private burst(texture: Texture, at: BoardPoint): void {
    const sprite = this.sprite(texture);
    sprite.position.set(at.x * TILE_SIZE, at.y * TILE_SIZE);
    const pose = burstPose(0);
    if (pose !== null) sprite.scale.set(pose.scale);
    this.bursting.push({ sprite, ageMs: 0 });
  }

  /** Puts a gold pop where its age has it; false once it is done. */
  private placeGold(pop: GoldPop): boolean {
    const pose = goldPose(pop.ageMs);
    if (pose === null) return false;
    const y = pop.y - pose.rise;
    const width = COIN_SIZE + pop.label.width;
    pop.coin.position.set(pop.x - width / 2 + COIN_SIZE / 2, y);
    pop.label.position.set(pop.x - width / 2 + COIN_SIZE, y);
    pop.coin.alpha = pose.alpha;
    pop.label.alpha = pose.alpha;
    return true;
  }

  /** A sprite from the pool, showing `texture`, reset and on top of `layer`. */
  private sprite(texture: Texture, layer: Container = this.bursts): Sprite {
    const sprite = this.freeSprites.pop() ?? new Sprite({ anchor: 0.5 });
    sprite.texture = texture;
    sprite.visible = true;
    sprite.alpha = 1;
    sprite.rotation = 0;
    sprite.scale.set(1);
    layer.addChild(sprite);
    return sprite;
  }

  private release(sprite: Sprite): void {
    sprite.visible = false;
    this.freeSprites.push(sprite);
  }

  private newLabel(): BitmapText {
    return new BitmapText({
      text: "",
      anchor: { x: 0, y: 0.5 },
      style: { fontFamily: GOLD_FONT, fontSize: GOLD_FONT_SIZE },
    });
  }

  /** The gold font is drawn on first use, by when the page's display font has loaded. */
  private installFont(): void {
    if (this.fontReady) return;
    BitmapFont.install({
      name: GOLD_FONT,
      style: {
        fontFamily: ["Fredoka", "system-ui", "sans-serif"],
        fontSize: GOLD_FONT_SIZE,
        fontWeight: "700",
        fill: BLOOM_COLOUR,
        stroke: { color: OUTLINE_COLOUR, width: 4, join: "round" },
      },
      chars: [["0", "9"], "+g"],
      resolution: window.devicePixelRatio * 2,
    });
    this.fontReady = true;
  }
}

function centreOf(tile: Tile): BoardPoint {
  return { x: tile.column + 0.5, y: tile.row + 0.5 };
}
