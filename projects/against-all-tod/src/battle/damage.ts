import type { PieceId } from "../catalog/pieces";
import type { Tile } from "../maze/board";
import type { DudeState } from "./dudes";
import type { BattleEvent } from "./events";

/** The Piece a hit came from, for the kill event. */
export interface HitSource {
  readonly pieceId: PieceId;
  readonly pieceTile: Tile;
}

/**
 * The damage Dudes take in one phase of a step (a volley, a beam, the walk over floor Pieces),
 * kept beside the phase's Dude list rather than in it. Every hit goes through here, so the
 * Mutations that change how damage lands work the same for shots, beams and Grinders: a small
 * shield soaks first (Explosive Shields), and a Conga Line member shares the hit evenly with its
 * living Stroke-mates. Kills and shield bursts are pushed to `events` as they happen.
 */
export class DudeHits {
  /** The Dudes a hit changed, by id; null marks a kill. */
  private readonly changed = new Map<number, DudeState | null>();
  private strokes: Map<number, DudeState[]> | null = null;

  constructor(
    private readonly dudes: readonly DudeState[],
    private readonly step: number,
    private readonly events: BattleEvent[],
  ) {}

  /** The Dude as it stands after the hits so far; null once killed. */
  current(dude: DudeState): DudeState | null {
    return this.changed.has(dude.id)
      ? (this.changed.get(dude.id) ?? null)
      : dude;
  }

  /** Records a change that isn't damage to health, such as a Shield Bro's shield soaking a shot. */
  record(dude: DudeState): void {
    this.changed.set(dude.id, dude);
  }

  /** `dude` left the Board without dying (reached a Goal, spent itself): it shares no more hits. */
  leave(dude: DudeState): void {
    this.changed.set(dude.id, null);
  }

  /** `damage` to `dude`, shared across its Stroke under Conga Line. */
  hurt(dude: DudeState, damage: number, source: HitSource): void {
    const strokeMates =
      dude.congaStroke === undefined ? [] : this.livingStroke(dude.congaStroke);
    const takers = strokeMates.length === 0 ? [dude] : strokeMates;
    const share = damage / takers.length;
    for (const taker of takers) this.hurtOne(taker, share, source);
  }

  /** Kills `dude` whatever its health and shields, as a Grinder does a small kind. Never shared. */
  kill(dude: DudeState, source: HitSource): void {
    const now = this.current(dude);
    if (now !== null) this.killNow(now, source);
  }

  /** `dudes` in their order with every hit applied and the killed left out. */
  applyTo(dudes: readonly DudeState[]): DudeState[] {
    if (this.changed.size === 0) return [...dudes];
    const result: DudeState[] = [];
    for (const dude of dudes) {
      if (!this.changed.has(dude.id)) {
        result.push(dude);
        continue;
      }
      const hit = this.changed.get(dude.id);
      if (hit == null) continue;
      // Only the wounds carry over: `dude` may have walked since it was hit.
      result.push({
        ...dude,
        health: hit.health,
        shield: hit.shield,
        ...(hit.smallShield === undefined
          ? {}
          : { smallShield: hit.smallShield }),
      });
    }
    return result;
  }

  private hurtOne(dude: DudeState, damage: number, source: HitSource): void {
    const now = this.current(dude);
    if (now === null) return;
    const shieldBefore = now.smallShield ?? 0;
    const soaked = Math.min(shieldBefore, damage);
    if (shieldBefore > 0 && soaked === shieldBefore) {
      this.events.push({
        type: "shield-burst",
        step: this.step,
        dudeId: now.id,
        at: { x: now.x, y: now.y },
      });
    }
    const health = now.health - (damage - soaked);
    const hurt =
      shieldBefore > 0
        ? { ...now, health, smallShield: shieldBefore - soaked }
        : { ...now, health };
    if (health > 0) this.changed.set(now.id, hurt);
    else this.killNow(hurt, source);
  }

  private killNow(dude: DudeState, { pieceId, pieceTile }: HitSource): void {
    this.changed.set(dude.id, null);
    this.events.push({
      type: "kill",
      step: this.step,
      pieceId,
      pieceTile,
      dudeId: dude.id,
      dudeKind: dude.kind,
      at: { x: dude.x, y: dude.y },
    });
  }

  private livingStroke(stroke: number): DudeState[] {
    if (this.strokes === null) {
      this.strokes = new Map();
      for (const dude of this.dudes) {
        if (dude.congaStroke === undefined) continue;
        const members = this.strokes.get(dude.congaStroke) ?? [];
        members.push(dude);
        this.strokes.set(dude.congaStroke, members);
      }
    }
    return (this.strokes.get(stroke) ?? []).filter(
      (dude) => this.current(dude) !== null,
    );
  }
}
