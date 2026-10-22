/**
 * How each effect looks as it ages, in real milliseconds. Ordinary effects are over in about a
 * fifth of a second, so a swarm's worth of hits never piles up on screen; a gold pop stays a
 * little longer so its number can be read.
 */

/** A Sniper Nest's bullet flies from the barrel to the Dude in this long; the puff follows. */
export const BULLET_MS = 100;
/** A star puff or a bonk. */
export const BURST_MS = 200;
/** A "+Xg" gold pop: long enough to read. */
export const GOLD_POP_MS = 600;
/** A Termite chews every step; one bonk per Piece this often is enough to see. */
export const BONK_GAP_MS = 250;

const GOLD_RISE_PX = 28;
const BURST_START_SCALE = 0.5;
const BURST_PEAK_SCALE = 1.15;
/** A burst grows for this share of its life, then fades for the rest. */
const BURST_GROW_SHARE = 0.35;

export interface BurstPose {
  readonly scale: number;
  readonly alpha: number;
}

export interface GoldPose {
  /** Pixels above where the gold was earned. */
  readonly rise: number;
  readonly alpha: number;
}

/** How far along its flight a bullet is, from 0 to 1; null once it has landed. */
export function bulletProgress(ageMs: number): number | null {
  return ageMs >= BULLET_MS ? null : Math.max(0, ageMs / BULLET_MS);
}

/** A puff or bonk pops out past full size, then fades as it settles; null once it is gone. */
export function burstPose(ageMs: number): BurstPose | null {
  if (ageMs >= BURST_MS) return null;
  const life = Math.max(0, ageMs / BURST_MS);
  if (life < BURST_GROW_SHARE) {
    const grown = life / BURST_GROW_SHARE;
    return {
      scale: BURST_START_SCALE + (BURST_PEAK_SCALE - BURST_START_SCALE) * grown,
      alpha: 1,
    };
  }
  const faded = (life - BURST_GROW_SHARE) / (1 - BURST_GROW_SHARE);
  return { scale: BURST_PEAK_SCALE - 0.15 * faded, alpha: 1 - faded };
}

/** A gold pop drifts up and fades out over its second half; null once it is gone. */
export function goldPose(ageMs: number): GoldPose | null {
  if (ageMs >= GOLD_POP_MS) return null;
  const life = Math.max(0, ageMs / GOLD_POP_MS);
  return {
    rise: GOLD_RISE_PX * Math.sqrt(life),
    alpha: life < 0.5 ? 1 : 2 * (1 - life),
  };
}
