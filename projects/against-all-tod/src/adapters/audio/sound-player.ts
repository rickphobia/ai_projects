import shotUrl from "../../../assets/kenney-sounds/laserSmall_000.ogg";
import killUrl from "../../../assets/kenney-sounds/slime_000.ogg";
import goldUrl from "../../../assets/kenney-sounds/handleCoins.ogg";
import goalHitUrl from "../../../assets/kenney-sounds/impactMetal_000.ogg";
import roundEndUrl from "../../../assets/kenney-sounds/forceField_000.ogg";
import type { Logger } from "../../logger";
import { finalLevel, type SoundId } from "./sound-level";

const SOUND_URLS: Readonly<Record<SoundId, string>> = {
  shot: shotUrl,
  kill: killUrl,
  gold: goldUrl,
  "goal-hit": goalHitUrl,
  "round-end": roundEndUrl,
};

/**
 * A sound starts again only after this long, so hundreds of towers firing in one frame make
 * one shot sound rather than a wall of noise.
 */
const MIN_GAP_MS = 80;

/** What the rest of the game may ask of the sound: play, and how loud. */
export interface GameSounds {
  play(sounds: Iterable<SoundId>): void;
  setActualVolume(volume: number): void;
  setVolumeTrick(position: number): void;
}

/** Plays the Kenney clips through `<audio>` elements, at the actual volume × the Volume trick. */
export class SoundPlayer implements GameSounds {
  private readonly clips = new Map<SoundId, HTMLAudioElement>();
  private readonly lastPlayedMs = new Map<SoundId, number>();
  private actualVolume: number;
  private volumePosition = 0;

  constructor(
    private readonly logger: Logger,
    actualVolume: number,
  ) {
    this.actualVolume = actualVolume;
    for (const [id, url] of Object.entries(SOUND_URLS)) {
      const clip = new Audio(url);
      clip.preload = "auto";
      this.clips.set(id as SoundId, clip);
    }
  }

  setActualVolume(volume: number): void {
    this.actualVolume = volume;
  }

  setVolumeTrick(position: number): void {
    this.volumePosition = position;
  }

  play(sounds: Iterable<SoundId>): void {
    const level = finalLevel(this.actualVolume, this.volumePosition);
    if (level === 0) return;
    const now = performance.now();
    for (const id of sounds) {
      const last = this.lastPlayedMs.get(id);
      if (last !== undefined && now - last < MIN_GAP_MS) continue;
      const clip = this.clips.get(id);
      if (clip === undefined) continue;
      this.lastPlayedMs.set(id, now);
      // A copy, so a sound can overlap its own tail.
      const voice = clip.cloneNode() as HTMLAudioElement;
      voice.volume = level;
      voice.play().catch((error: unknown) => {
        // Browsers refuse sound until the player has touched the page; that is not an error.
        this.logger.debug("sound not played", { sound: id, error });
      });
    }
  }
}
