import type { BattleEvent } from "../../battle/events";
import { TRICK_RULES } from "../../catalog/tricks";

/** The game's sounds. Each one is a Kenney clip in `assets/kenney-sounds/`. */
export type SoundId = "shot" | "kill" | "gold" | "goal-hit" | "round-end";

/** The pause-menu volume a new player starts with, leaving room for Volume up to be louder. */
export const DEFAULT_ACTUAL_VOLUME = 0.5;

/** How loud the Volume trick makes the game at a slider position: 1 in the middle. */
export function trickLoudness(volumePosition: number): number {
  return Math.max(0, 1 + TRICK_RULES.loudnessPerVolumeStep * volumePosition);
}

/**
 * The level a sound plays at: the player's actual volume (0 to 1) times the Volume trick's
 * loudness, so the trick really quiets the game while the pause-menu slider stays honest. Never
 * above 1, the loudest a browser plays.
 */
export function finalLevel(
  actualVolume: number,
  volumePosition: number,
): number {
  const actual = Math.min(1, Math.max(0, actualVolume));
  return Math.min(1, actual * trickLoudness(volumePosition));
}

/** The sounds a frame's battle events make, each at most once however many fired. */
export function soundsOf(events: readonly BattleEvent[]): Set<SoundId> {
  const sounds = new Set<SoundId>();
  for (const event of events) {
    if (event.type === "shot") sounds.add("shot");
    else if (event.type === "kill") sounds.add("kill");
    else if (event.type === "reach-goal") sounds.add("goal-hit");
    else if (event.type === "taxed") sounds.add("gold");
  }
  return sounds;
}
