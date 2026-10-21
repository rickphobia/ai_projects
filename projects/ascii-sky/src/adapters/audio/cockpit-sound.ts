import type { ToneSettings } from "./tone-settings";

/** The few WebAudio calls the sound uses, so tests can pass a fake. */
export type AudioContextLike = Pick<
  BaseAudioContext,
  "createOscillator" | "createGain" | "destination" | "currentTime" | "state"
> & { resume(): Promise<void> };

export interface CockpitSound {
  /** Starts the sound; browsers only allow this from a user gesture such as a key press. */
  start(): Promise<void>;
  update(settings: ToneSettings): void;
}

/** The stall horn: a steady high tone, like a C172's reed horn. */
const HORN_HZ = 1600;
const HORN_VOLUME = 0.08;
/** Overall level, so the full mix stays well under clipping. */
const MASTER_VOLUME = 0.3;
/** Seconds for a setting to glide to its new value, so changes don't click. */
const GLIDE_SECONDS = 0.05;

export function createCockpitSound(context: AudioContextLike): CockpitSound {
  const master = context.createGain();
  master.gain.value = MASTER_VOLUME;
  master.connect(context.destination);

  // A sawtooth has the harmonics of a piston engine; a sine would sound like a whistle.
  const engine = context.createOscillator();
  engine.type = "sawtooth";
  const engineGain = context.createGain();
  engineGain.gain.value = 0;
  engine.connect(engineGain).connect(master);

  const horn = context.createOscillator();
  horn.type = "square";
  horn.frequency.value = HORN_HZ;
  const hornGain = context.createGain();
  hornGain.gain.value = 0;
  horn.connect(hornGain).connect(master);

  let started = false;
  return {
    async start() {
      if (!started) {
        engine.start();
        horn.start();
        started = true;
      }
      if (context.state !== "running") await context.resume();
    },
    update(settings) {
      const now = context.currentTime;
      engine.frequency.setTargetAtTime(settings.engineHz, now, GLIDE_SECONDS);
      engineGain.gain.setTargetAtTime(
        settings.engineVolume,
        now,
        GLIDE_SECONDS,
      );
      hornGain.gain.setTargetAtTime(
        settings.hornOn ? HORN_VOLUME : 0,
        now,
        GLIDE_SECONDS,
      );
    },
  };
}
