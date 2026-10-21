import { describe, expect, it } from "vitest";
import { type Action, type Controls } from "../../src/game/controls";
import { advance, type GameState, newGame } from "../../src/game/game";
import type { BrightnessGrid } from "../../src/screen/brightness-grid";
import { drawGame } from "../../src/screen/game-screen";
import {
  PRINTABLE_ASCII,
  SCREEN_COLUMNS,
  SCREEN_ROWS,
  VIEW_COLUMNS,
  VIEW_ROWS,
} from "../../src/screen/screen-size";
import { createWorld } from "../../src/world/world";
import { WORLD_LAYOUT } from "../../src/world/world-layout";

const world = createWorld(WORLD_LAYOUT);
const FRAME = 1 / 60;
const DEGREES = Math.PI / 180;
const KNOTS_PER_METRE_PER_SECOND = 1.94384;
const VIEW: BrightnessGrid = {
  columns: VIEW_COLUMNS,
  rows: VIEW_ROWS,
  values: new Float32Array(VIEW_COLUMNS * VIEW_ROWS).fill(0),
};

function holding(...actions: Action[]): Controls {
  return new Set(actions);
}

interface Approach {
  x: number;
  y: number;
  sinkRate?: number;
  speed?: number;
  bankDegrees?: number;
  pitchDegrees?: number;
}

/** The Plane a few centimetres above the ground, heading north, about to touch down. */
function approaching({
  x,
  y,
  sinkRate = 1.5,
  speed = 30,
  bankDegrees = 0,
  pitchDegrees = 5,
}: Approach): GameState {
  const flying = advance(newGame(world), holding("start"), FRAME);
  return {
    ...flying,
    plane: {
      ...flying.plane,
      position: { x, y, z: world.groundHeight(x, y) + 0.02 },
      velocity: { x: 0, y: speed, z: -sinkRate },
      heading: 0,
      pitch: pitchDegrees * DEGREES,
      roll: bankDegrees * DEGREES,
      onGround: false,
    },
  };
}

/** Holds the controls until the Flight ends, or two minutes pass. */
function untilEnded(start: GameState, controls = holding("brakes")) {
  let state = start;
  for (let frame = 0; frame < 120 * 60 && state.phase !== "ended"; frame++) {
    state = advance(state, controls, FRAME);
  }
  return state;
}

function ending(state: GameState): string | undefined {
  return state.flightEnd?.ending;
}

const RUNWAY = { x: world.runway.x + 4, y: world.runway.y - 200 };
const GRASS = { x: world.runway.x - 300, y: world.runway.y };
const LAKE = { x: world.lake.x, y: world.lake.y };
const HILLTOP = {
  x: WORLD_LAYOUT.hills[0]?.x ?? 0,
  y: WORLD_LAYOUT.hills[0]?.y ?? 0,
};

describe("ending a Flight", () => {
  it("ends Landed after a gentle wings-level Runway Touchdown rolls to a stop", () => {
    const start = approaching({ ...RUNWAY, sinkRate: 1.5, speed: 30 });
    const touchedDown = advance(start, holding("brakes"), 0.1);
    expect(touchedDown.plane.onGround).toBe(true);
    expect(touchedDown.phase).toBe("flying");

    const ended = untilEnded(touchedDown);
    expect(ending(ended)).toBe("landed");
    expect(ended.plane.onGround).toBe(true);
    const stats = ended.flightEnd?.stats;
    expect(stats?.sinkRate).toBeCloseTo(1.5, 0);
    expect(stats?.speed).toBeCloseTo(30, 0);
    expect(stats?.bank).toBeCloseTo(0);
    expect(stats?.centrelineDistance).toBeCloseTo(4);
  });

  it("does not end the Flight while the Plane stands on the Runway before take-off", () => {
    const state = untilEnded(advance(newGame(world), holding("start"), FRAME));
    expect(state.phase).toBe("flying");
  });

  it("ends Crashed when the same Touchdown is banked 30 degrees", () => {
    const ended = untilEnded(approaching({ ...RUNWAY, bankDegrees: 30 }));
    expect(ending(ended)).toBe("crashed");
    expect(ended.flightEnd?.stats.bank).toBeCloseTo(30 * DEGREES, 1);
  });

  it("ends Crashed on a high sink rate", () => {
    const ended = untilEnded(approaching({ ...RUNWAY, sinkRate: 6 }));
    expect(ending(ended)).toBe("crashed");
    expect(ended.flightEnd?.stats.sinkRate).toBeGreaterThan(5);
  });

  it("ends Crashed when the nose is down at Touchdown", () => {
    const ended = untilEnded(approaching({ ...RUNWAY, pitchDegrees: -4 }));
    expect(ending(ended)).toBe("crashed");
  });

  it("ends Landed off-runway after a gentle Touchdown on grass", () => {
    expect(world.surfaceAt(GRASS.x, GRASS.y)).toBe("grass");
    const ended = untilEnded(approaching(GRASS));
    expect(ending(ended)).toBe("landedOffRunway");
    expect(ended.flightEnd?.stats.centrelineDistance).toBeCloseTo(300, -1);
  });

  it("ends Crashed on the lake, however gentle", () => {
    expect(world.surfaceAt(LAKE.x, LAKE.y)).toBe("lake");
    expect(ending(untilEnded(approaching(LAKE)))).toBe("crashed");
  });

  it("ends Crashed on a hill, however gentle", () => {
    expect(world.surfaceAt(HILLTOP.x, HILLTOP.y)).toBe("hill");
    expect(ending(untilEnded(approaching(HILLTOP)))).toBe("crashed");
  });

  it("freezes the Plane once the Flight has ended", () => {
    const ended = untilEnded(approaching({ ...RUNWAY, sinkRate: 6 }));
    const later = advance(ended, holding("throttleUp"), 1);
    expect(later.phase).toBe("ended");
    expect(later.plane).toBe(ended.plane);
  });

  it("starts a fresh Flight on the Runway when R is pressed after the end", () => {
    const ended = untilEnded(approaching(GRASS));
    const fresh = advance(newGame(world), holding("start"), FRAME);
    const restarted = advance(ended, holding("restart"), FRAME);
    expect(restarted.phase).toBe("flying");
    expect(restarted.flightEnd).toBeNull();
    expect(restarted.plane.position).toEqual(fresh.plane.position);
    expect(restarted.plane.onGround).toBe(true);
    expect(restarted.plane.throttle).toBe(0);
  });
});

describe("drawing the end of a Flight", () => {
  function screenText(state: GameState): string {
    const lines = drawGame(state, VIEW);
    expect(lines).toHaveLength(SCREEN_ROWS);
    for (const line of lines) {
      expect(line).toHaveLength(SCREEN_COLUMNS);
      expect(line).toMatch(PRINTABLE_ASCII);
    }
    return lines.join("\n");
  }

  it("shows LANDED with the Touchdown stats", () => {
    const ended = untilEnded(approaching({ ...RUNWAY, speed: 30 }));
    const text = screenText(ended);
    expect(text).toContain("LANDED");
    expect(text).not.toContain("OFF-RUNWAY");
    const speed = ended.flightEnd?.stats.speed ?? 0;
    expect(text).toContain(
      `${String(Math.round(speed * KNOTS_PER_METRE_PER_SECOND))} KNOTS`,
    );
    expect(text).toContain("SINK RATE");
    expect(text).toContain("BANK");
    // 4 m is 13 ft.
    expect(text).toContain("13 FT OFF CENTRELINE");
    expect(text).toContain("Press R to fly again");
  });

  it("shows LANDED OFF-RUNWAY after a grass landing", () => {
    expect(screenText(untilEnded(approaching(GRASS)))).toContain(
      "LANDED OFF-RUNWAY",
    );
  });

  it("shows CRASHED and why after a crash", () => {
    const lake = screenText(untilEnded(approaching(LAKE)));
    expect(lake).toContain("CRASHED");
    expect(lake).toContain("into the lake");
    const banked = screenText(
      untilEnded(approaching({ ...RUNWAY, bankDegrees: 30 })),
    );
    expect(banked).toContain("banked too steeply");
  });
});
