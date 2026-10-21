/**
 * How Dudes wobble, panic and flop on screen. Cosmetic only (art-pass spec): everything here comes
 * from a Dude's id and the battle step, never from randomness or the clock, so a replay looks the
 * same, and nothing here feeds back into the battle.
 */

/** One waddle, left foot and right, takes this many battle steps. */
export const WADDLE_STEPS = 24;
/** How far a waddling Dude rocks either way, in radians. */
const WADDLE_TILT = 0.2;
/** How high a waddling Dude bobs on each step, in px of its drawing. */
const WADDLE_BOB = 2;
/** Spreads Dudes' phases so a crowd doesn't rock in step; the golden angle never repeats soon. */
const PHASE_PER_ID = Math.PI * (3 - Math.sqrt(5));
/** A hit Dude looks panicked for this many steps (a quarter of a second at 60 steps a second). */
export const PANIC_STEPS = 15;
/** A dead Dude tips over in the first part of this many steps, then fades for the rest. */
export const FLOP_STEPS = 30;
const FLOP_TURN_SHARE = 0.4;

export interface Waddle {
  /** Radians, positive leaning forward-right. */
  readonly tilt: number;
  /** Px up from where the Dude stands. */
  readonly bob: number;
}

/** How a walking Dude rocks at a battle step. */
export function waddle(dudeId: number, step: number): Waddle {
  const phase = dudeId * PHASE_PER_ID + (step / WADDLE_STEPS) * 2 * Math.PI;
  return {
    tilt: Math.sin(phase) * WADDLE_TILT,
    bob: Math.abs(Math.sin(phase)) * WADDLE_BOB,
  };
}

export interface Flop {
  /** 0 standing to 1 lying on its side. */
  readonly turn: number;
  /** 1 to 0. */
  readonly alpha: number;
}

/** A dead Dude `steps` after it died; null once it is gone. */
export function flop(steps: number): Flop | null {
  if (steps >= FLOP_STEPS) return null;
  const turnSteps = FLOP_STEPS * FLOP_TURN_SHARE;
  const turned = Math.min(1, Math.max(0, steps) / turnSteps);
  const fading = Math.max(0, steps - turnSteps) / (FLOP_STEPS - turnSteps);
  return { turn: 1 - (1 - turned) ** 2, alpha: 1 - fading };
}
