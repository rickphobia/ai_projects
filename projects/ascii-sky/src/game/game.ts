import { stepPlane } from "../flight/flight-model";
import { type Plane, planeOnRunway } from "../flight/plane";
import { TUNING } from "../flight/tuning";
import type { World } from "../world/world";
import type { Controls } from "./controls";

export type Phase = "title" | "flying" | "paused";

export interface GameState {
  readonly phase: Phase;
  /** Whether pause was held last Advance, so holding the key toggles once rather than every frame. */
  readonly pauseHeld: boolean;
  readonly world: World;
  readonly plane: Plane;
  /** Flying time not yet run because it is shorter than one step; it carries into the next Advance. */
  readonly unsteppedSeconds: number;
}

export function newGame(world: World): GameState {
  return {
    phase: "title",
    pauseHeld: false,
    world,
    plane: planeOnRunway(world),
    unsteppedSeconds: 0,
  };
}

/** Rounding slack, so time that adds up to a whole number of steps isn't left one step short. */
const STEP_SLACK = 1e-9;

/** Advance: the next game state, given the controls held down now and the seconds since the last Advance. */
export function advance(
  state: GameState,
  controls: Controls,
  elapsedSeconds: number,
): GameState {
  const pauseHeld = controls.has("pause");
  const pausePressed = pauseHeld && !state.pauseHeld;
  const phase = nextPhase(state.phase, controls, pausePressed);
  if (phase !== "flying" || state.phase !== "flying") {
    return { ...state, phase, pauseHeld };
  }
  // The flight model runs in fixed steps, so the same controls over the same time give the
  // same Flight however the time is split into frames.
  const flyingSeconds =
    state.unsteppedSeconds + Math.min(elapsedSeconds, TUNING.maxFrameSeconds);
  const steps = Math.floor((flyingSeconds + STEP_SLACK) / TUNING.stepSeconds);
  let plane = state.plane;
  for (let step = 0; step < steps; step++) {
    plane = stepPlane(plane, controls, state.world, TUNING.stepSeconds);
  }
  return {
    ...state,
    phase,
    pauseHeld,
    plane,
    unsteppedSeconds: Math.max(0, flyingSeconds - steps * TUNING.stepSeconds),
  };
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
