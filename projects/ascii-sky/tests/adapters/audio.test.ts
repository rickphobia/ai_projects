import { describe, expect, it } from "vitest";
import {
  type AudioContextLike,
  createCockpitSound,
} from "../../src/adapters/audio/cockpit-sound";
import { SILENT, toneSettings } from "../../src/adapters/audio/tone-settings";
import { type Plane, planeOnRunway } from "../../src/flight/plane";
import { type GameState, newGame, type Phase } from "../../src/game/game";
import { createWorld } from "../../src/world/world";
import { WORLD_LAYOUT } from "../../src/world/world-layout";

const world = createWorld(WORLD_LAYOUT);

function state(phase: Phase, changes: Partial<Plane> = {}): GameState {
  return {
    ...newGame(world),
    phase,
    plane: { ...planeOnRunway(world), ...changes },
  };
}

describe("tone settings", () => {
  it("is silent on the title screen, while paused and after a Flight ends", () => {
    for (const phase of ["title", "paused", "ended"] as const) {
      expect(
        toneSettings(state(phase, { throttle: 1, stalled: true })),
      ).toEqual(SILENT);
    }
  });

  it("raises the engine's pitch and volume with RPM", () => {
    const idle = toneSettings(state("flying", { throttle: 0 }));
    const full = toneSettings(state("flying", { throttle: 1 }));
    expect(idle.engineVolume).toBeGreaterThan(0);
    expect(full.engineHz).toBeGreaterThan(idle.engineHz);
    expect(full.engineVolume).toBeGreaterThan(idle.engineVolume);
  });

  it("sounds the horn only while the Plane is in a Stall", () => {
    expect(toneSettings(state("flying", { stalled: true })).hornOn).toBe(true);
    expect(toneSettings(state("flying", { stalled: false })).hornOn).toBe(
      false,
    );
  });
});

interface FakeParam {
  value: number;
  setTargetAtTime(target: number): void;
}

function fakeParam(): FakeParam {
  return {
    value: 0,
    setTargetAtTime(target) {
      this.value = target;
    },
  };
}

function fakeContext() {
  const oscillators: { frequency: FakeParam; started: number }[] = [];
  const gains: { gain: FakeParam }[] = [];
  const node = { connect: (next: unknown) => next };
  const context = {
    state: "suspended",
    currentTime: 0,
    destination: {},
    resumed: 0,
    resume() {
      this.resumed++;
      this.state = "running";
      return Promise.resolve();
    },
    createOscillator() {
      const oscillator = {
        ...node,
        type: "sine",
        frequency: fakeParam(),
        started: 0,
        start() {
          this.started++;
        },
      };
      oscillators.push(oscillator);
      return oscillator;
    },
    createGain() {
      const gain = { ...node, gain: fakeParam() };
      gains.push(gain);
      return gain;
    },
  };
  return { context, oscillators, gains };
}

describe("cockpit sound", () => {
  it("starts the oscillators once and resumes the context", async () => {
    const fake = fakeContext();
    const sound = createCockpitSound(
      fake.context as unknown as AudioContextLike,
    );
    await sound.start();
    await sound.start();
    expect(fake.oscillators.map((o) => o.started)).toEqual([1, 1]);
    expect(fake.context.resumed).toBe(1);
  });

  it("sets the engine tone and the horn from the tone settings", () => {
    const fake = fakeContext();
    const sound = createCockpitSound(
      fake.context as unknown as AudioContextLike,
    );
    const [, engineGain, hornGain] = fake.gains;
    sound.update({ engineHz: 90, engineVolume: 0.4, hornOn: true });
    expect(fake.oscillators[0]?.frequency.value).toBe(90);
    expect(engineGain?.gain.value).toBe(0.4);
    expect(hornGain?.gain.value).toBeGreaterThan(0);
    sound.update(SILENT);
    expect(engineGain?.gain.value).toBe(0);
    expect(hornGain?.gain.value).toBe(0);
  });
});
