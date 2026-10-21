import { engineRpm, IDLE_RPM, REDLINE_RPM } from "../../flight/engine-rpm";
import type { GameState } from "../../game/game";

/** What the sound should be doing for one game state; volumes are 0 to 1. */
export interface ToneSettings {
  readonly engineHz: number;
  readonly engineVolume: number;
  readonly hornOn: boolean;
}

/** A low drone at idle rising to a buzz near redline; the numbers are by ear, not a real C172. */
const IDLE_HZ = 45;
const REDLINE_HZ = 140;
const IDLE_VOLUME = 0.25;
const REDLINE_VOLUME = 0.6;

export const SILENT: ToneSettings = {
  engineHz: IDLE_HZ,
  engineVolume: 0,
  hornOn: false,
};

/** Sound only while flying: the title screen, a pause and an ended Flight are silent. */
export function toneSettings(state: GameState): ToneSettings {
  if (state.phase !== "flying") return SILENT;
  const power = (engineRpm(state.plane) - IDLE_RPM) / (REDLINE_RPM - IDLE_RPM);
  return {
    engineHz: IDLE_HZ + power * (REDLINE_HZ - IDLE_HZ),
    engineVolume: IDLE_VOLUME + power * (REDLINE_VOLUME - IDLE_VOLUME),
    hornOn: state.plane.stalled,
  };
}
