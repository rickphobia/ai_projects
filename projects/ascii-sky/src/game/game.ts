import type { Controls } from "./controls";

export type Phase = "title" | "flying" | "paused";

export interface GameState {
  readonly phase: Phase;
  /** Whether pause was held last Advance, so holding the key toggles once rather than every frame. */
  readonly pauseHeld: boolean;
}

export function newGame(): GameState {
  return { phase: "title", pauseHeld: false };
}

/** Advance: the next game state, given the controls held down now and the seconds since the last Advance. */
export function advance(
  state: GameState,
  controls: Controls,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the Plane starts moving in ticket 04
  elapsedSeconds: number,
): GameState {
  const pauseHeld = controls.has("pause");
  const pausePressed = pauseHeld && !state.pauseHeld;
  return { phase: nextPhase(state.phase, controls, pausePressed), pauseHeld };
}

function nextPhase(
  phase: Phase,
  controls: Controls,
  pausePressed: boolean,
): Phase {
  switch (phase) {
    case "title":
      return controls.has("start") ? "flying" : "title";
    case "flying":
      return pausePressed ? "paused" : "flying";
    case "paused":
      return pausePressed ? "flying" : "paused";
  }
}

/** Pauses a Flight in progress, e.g. when the tab is hidden; leaves the title screen alone. */
export function pauseGame(state: GameState): GameState {
  return state.phase === "flying" ? { ...state, phase: "paused" } : state;
}
