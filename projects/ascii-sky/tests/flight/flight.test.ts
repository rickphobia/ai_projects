import { describe, expect, it } from "vitest";
import { type Action, type Controls } from "../../src/game/controls";
import { advance, type GameState, newGame } from "../../src/game/game";
import { createWorld } from "../../src/world/world";
import { WORLD_LAYOUT } from "../../src/world/world-layout";

const world = createWorld(WORLD_LAYOUT);
const FRAME = 1 / 60;

function holding(...actions: Action[]): Controls {
  return new Set(actions);
}

function onTheRunway(): GameState {
  return advance(newGame(world), holding("start"), FRAME);
}

/** Holds the controls for `seconds`, in frames of `frame` seconds. */
function fly(
  state: GameState,
  controls: Controls,
  seconds: number,
  frame = FRAME,
): GameState {
  let next = state;
  const frames = Math.round(seconds / frame);
  for (let count = 0; count < frames; count++) {
    next = advance(next, controls, frame);
  }
  return next;
}

function distanceFrom(from: GameState, to: GameState): number {
  return Math.hypot(
    to.plane.position.x - from.plane.position.x,
    to.plane.position.y - from.plane.position.y,
  );
}

function heightAboveGround(state: GameState): number {
  const { x, y, z } = state.plane.position;
  return z - world.groundHeight(x, y);
}

/** Full throttle, holding the nose up, until the wheels leave the ground. */
function takeOff(start: GameState): GameState {
  let state = start;
  for (let frame = 0; frame < 60 * 60 && state.plane.onGround; frame++) {
    state = advance(state, holding("throttleUp", "pitchUp"), FRAME);
  }
  return state;
}

/** Off the Runway and climbing at a steady speed, wings level, a few hundred metres up. */
function cruising(): GameState {
  let state = takeOff(onTheRunway());
  state = fly(state, holding("throttleUp", "pitchUp"), 5);
  return fly(state, holding(), 40);
}

describe("on the Runway", () => {
  it("stays put with the brakes on at idle", () => {
    const start = onTheRunway();
    const after = fly(start, holding("brakes"), 10);
    expect(distanceFrom(start, after)).toBe(0);
    expect(after.plane.onGround).toBe(true);
    expect(after.plane.brakes).toBe(true);
  });

  it("rolls forward under throttle", () => {
    const start = onTheRunway();
    const after = fly(start, holding("throttleUp"), 5);
    expect(after.plane.throttle).toBe(1);
    expect(distanceFrom(start, after)).toBeGreaterThan(10);
    expect(after.plane.onGround).toBe(true);
  });

  it("lifts off at full throttle well within the Runway", () => {
    const start = onTheRunway();
    const lifted = takeOff(start);
    expect(lifted.plane.onGround).toBe(false);
    const roll = distanceFrom(start, lifted);
    // A Cessna 172's ground roll is about 300 m; the Runway ahead is 940 m.
    expect(roll).toBeGreaterThan(100);
    expect(roll).toBeLessThan(600);
    const climbed = fly(lifted, holding("throttleUp", "pitchUp"), 5);
    expect(heightAboveGround(climbed)).toBeGreaterThan(10);
  });

  it("lifts off by itself when fast enough, with the nose left alone", () => {
    const start = onTheRunway();
    let state = start;
    for (let frame = 0; frame < 60 * 60 && state.plane.onGround; frame++) {
      state = advance(state, holding("throttleUp"), FRAME);
    }
    expect(state.plane.onGround).toBe(false);
    expect(distanceFrom(start, state)).toBeLessThan(world.runway.length - 60);
  });

  it("steers with the rudder and stops with the brakes", () => {
    const rolling = fly(onTheRunway(), holding("throttleUp"), 4);
    const steered = fly(rolling, holding("rudderRight"), 1);
    expect(steered.plane.heading).toBeGreaterThan(0.05);
    const stopped = fly(steered, holding("throttleDown", "brakes"), 10);
    const speed = Math.hypot(
      stopped.plane.velocity.x,
      stopped.plane.velocity.y,
    );
    expect(speed).toBe(0);
  });
});

describe("in the air", () => {
  it("climbs out and settles to a steady speed with the controls let go", () => {
    const state = cruising();
    expect(state.plane.onGround).toBe(false);
    expect(heightAboveGround(state)).toBeGreaterThan(100);
    const speed = Math.hypot(
      state.plane.velocity.x,
      state.plane.velocity.y,
      state.plane.velocity.z,
    );
    expect(speed).toBeGreaterThan(30);
    expect(speed).toBeLessThan(65);
  });

  it("rolls with the arrows and turns while banked", () => {
    const level = cruising();
    const banked = fly(level, holding("throttleUp", "rollRight"), 1);
    expect(banked.plane.roll).toBeGreaterThan(0.2);
    const turned = fly(banked, holding("throttleUp"), 4);
    // Still banked, and the bank has turned the Plane.
    expect(turned.plane.roll).toBeGreaterThan(0.2);
    const headingChange = angleBetween(
      level.plane.heading,
      turned.plane.heading,
    );
    expect(headingChange).toBeGreaterThan(0.2);
  });

  it("pitches the nose up and down with the arrows", () => {
    const level = cruising();
    const up = fly(level, holding("throttleUp", "pitchUp"), 2);
    expect(up.plane.pitch).toBeGreaterThan(level.plane.pitch + 0.1);
    const down = fly(level, holding("throttleUp", "pitchDown"), 2);
    expect(down.plane.pitch).toBeLessThan(level.plane.pitch - 0.1);
  });
});

describe("stall and flaps", () => {
  it("stalls when pulled up at low speed, and the nose drops", () => {
    const stalled = pullUpUntilStalled(cruising());
    expect(stalled.plane.stalled).toBe(true);
    const later = fly(stalled, holding("throttleDown", "pitchUp"), 3);
    expect(later.plane.pitch).toBeLessThan(stalled.plane.pitch - 0.1);
  });

  it("recovers from a Stall with the nose lowered and power added", () => {
    const stalled = pullUpUntilStalled(cruising());
    const recovered = fly(stalled, holding("pitchDown", "throttleUp"), 5);
    expect(recovered.plane.stalled).toBe(false);
    expect(recovered.plane.onGround).toBe(false);
  });

  it("never stalls in steady flight with the controls let go", () => {
    let state = cruising();
    for (let frame = 0; frame < 60 * 30; frame++) {
      state = advance(state, holding(), FRAME);
      expect(state.plane.stalled).toBe(false);
    }
  });

  it("steps the flaps one setting per press of F, then back up", () => {
    let state = cruising();
    const settings = [state.plane.flaps];
    for (let press = 0; press < 4; press++) {
      // Holding F for a whole second still moves the flaps only once.
      state = fly(state, holding("flapsStep"), 1);
      state = advance(state, holding(), FRAME);
      settings.push(state.plane.flaps);
    }
    const [up, first, second, third, wrapped] = settings;
    expect(up).toBe(0);
    expect(first).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(first ?? Infinity);
    expect(third).toBeGreaterThan(second ?? Infinity);
    expect(wrapped).toBe(0);
  });

  it("stalls at a lower speed with the flaps down", () => {
    const clean = pullUpUntilStalled(cruising());
    const flapsDown = pullUpUntilStalled(withFullFlaps(cruising()));
    expect(flapsDown.plane.flaps).toBeGreaterThan(0);
    expect(airspeed(flapsDown)).toBeLessThan(airspeed(clean) - 2);
  });

  it("slows the Plane faster with the flaps down", () => {
    const cruise = cruising();
    const flapsDown = withFullFlaps(cruise);
    // Same flight, flaps changed only: lift acts across the path, so only drag can differ.
    const clean: GameState = {
      ...flapsDown,
      plane: { ...flapsDown.plane, flaps: 0 },
    };
    const step = (state: GameState): number =>
      airspeed(state) - airspeed(advance(state, holding(), FRAME));
    expect(step(flapsDown)).toBeGreaterThan(step(clean));
  });
});

describe("the World's edge", () => {
  it("holds the Plane inside", () => {
    const edge = world.halfSize;
    const cruise = cruising();
    // Heading east at cruise speed, just short of the edge, high above the hills.
    const nearEdge: GameState = {
      ...cruise,
      plane: {
        ...cruise.plane,
        position: { x: edge - 200, y: 0, z: 2_000 },
        velocity: { x: 50, y: 0, z: 0 },
        heading: Math.PI / 2,
        pitch: 0,
        roll: 0,
      },
    };
    const later = fly(nearEdge, holding("throttleUp"), 30);
    expect(Math.abs(later.plane.position.x)).toBeLessThan(edge);
    expect(Math.abs(later.plane.position.y)).toBeLessThan(edge);
  });
});

describe("fixed steps", () => {
  it("gives the same Flight whatever the frame lengths", () => {
    const start = onTheRunway();
    const controls = holding("throttleUp", "pitchUp", "rollLeft");
    const smooth = fly(start, controls, 30, 1 / 120);
    const choppy = fly(start, controls, 30, 1 / 20);
    let uneven = start;
    for (let frame = 0; frame < 300; frame++) {
      // 0.07 s and 0.13 s frames: neither a whole number of steps, so time carries over.
      uneven = advance(uneven, controls, frame % 2 === 0 ? 0.07 : 0.13);
    }
    for (const other of [choppy, uneven]) {
      expect(other.plane.position.x).toBeCloseTo(smooth.plane.position.x, 6);
      expect(other.plane.position.y).toBeCloseTo(smooth.plane.position.y, 6);
      expect(other.plane.position.z).toBeCloseTo(smooth.plane.position.z, 6);
      expect(other.plane.heading).toBeCloseTo(smooth.plane.heading, 9);
    }
  });

  it("does not move the Plane while paused", () => {
    const rolling = fly(onTheRunway(), holding("throttleUp"), 3);
    const paused = advance(rolling, holding("pause"), FRAME);
    const later = fly(paused, holding("throttleUp"), 5);
    expect(later.plane).toEqual(rolling.plane);
  });
});

/** Idle throttle and the nose held up, until the Stall flag sets (or a minute passes). */
function pullUpUntilStalled(start: GameState): GameState {
  let state = start;
  for (let frame = 0; frame < 60 * 60 && !state.plane.stalled; frame++) {
    state = advance(state, holding("throttleDown", "pitchUp"), FRAME);
  }
  return state;
}

/** Presses F until the flaps are at their last setting. */
function withFullFlaps(start: GameState): GameState {
  let state = start;
  for (let press = 0; press < 3; press++) {
    state = advance(state, holding("flapsStep"), FRAME);
    state = advance(state, holding(), FRAME);
  }
  return state;
}

function airspeed(state: GameState): number {
  const { x, y, z } = state.plane.velocity;
  return Math.hypot(x, y, z);
}

function angleBetween(from: number, to: number): number {
  const turn = Math.abs(to - from) % (2 * Math.PI);
  return Math.min(turn, 2 * Math.PI - turn);
}
