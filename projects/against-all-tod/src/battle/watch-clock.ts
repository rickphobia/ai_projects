import { STEPS_PER_SECOND } from "./battle";

/** How fast the player watches a battle. It changes how many steps run per real second, never what they do. */
export type WatchSpeed = 1 | 2 | 4;
export const WATCH_SPEEDS: readonly WatchSpeed[] = [1, 2, 4];

const STEP_MS = 1000 / STEPS_PER_SECOND;

/**
 * After a long pause (a hidden tab, a debugger) running every missed step at once would freeze
 * the page, so at most this much game time is caught up per frame; the rest is dropped.
 */
const MAX_CATCH_UP_SECONDS = 0.25;

export interface StepsDue {
  readonly steps: number;
  /** Real time not yet worth a whole step, carried into the next frame. */
  readonly carryMs: number;
}

/** How many battle steps a frame of `elapsedMs` real time is worth at `speed`. */
export function stepsDue(
  carryMs: number,
  elapsedMs: number,
  speed: WatchSpeed,
): StepsDue {
  const gameMs = carryMs + Math.max(0, elapsedMs) * speed;
  const steps = Math.floor(gameMs / STEP_MS);
  const maxSteps = Math.ceil(MAX_CATCH_UP_SECONDS * STEPS_PER_SECOND * speed);
  if (steps > maxSteps) return { steps: maxSteps, carryMs: 0 };
  return { steps, carryMs: gameMs - steps * STEP_MS };
}
