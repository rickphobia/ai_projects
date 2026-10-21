import { describe, expect, it } from "vitest";
import type { GameState } from "../../src/game/game";
import { newGame } from "../../src/game/game";
import { type Plane, planeOnRunway } from "../../src/flight/plane";
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
const VIEW: BrightnessGrid = {
  columns: VIEW_COLUMNS,
  rows: VIEW_ROWS,
  values: new Float32Array(VIEW_COLUMNS * VIEW_ROWS).fill(0.5),
};
const DEGREE = Math.PI / 180;
const INSTRUMENT_WIDTH = 16;

/** Flying north at 50 m/s, 300 m above the Runway, climbing 2.54 m/s (500 ft/min). */
function flying(changes: Partial<Plane> = {}): GameState {
  const onRunway = planeOnRunway(world);
  const plane: Plane = {
    ...onRunway,
    position: { x: 0, y: 0, z: world.runway.elevation + 300 },
    velocity: { x: 0, y: 50, z: 2.54 },
    heading: 0,
    throttle: 0.5,
    brakes: false,
    onGround: false,
    ...changes,
  };
  return { ...newGame(world), phase: "flying", plane };
}

function panel(state: GameState): string[] {
  return drawGame(state, VIEW).slice(VIEW_ROWS);
}

/** The text inside one box of the panel, counting the six flight instruments from 0 and the engine box as 6. */
function instrument(lines: readonly string[], index: number): string {
  const start = 1 + index * INSTRUMENT_WIDTH;
  const end = index === 6 ? SCREEN_COLUMNS - 1 : start + INSTRUMENT_WIDTH;
  return lines.map((line) => line.slice(start, end)).join("\n");
}

describe("the Instrument panel through Draw", () => {
  it("keeps the Screen 45 lines of 120 printable characters in any state", () => {
    const states = [
      flying(),
      flying({ roll: 170 * DEGREE, pitch: -60 * DEGREE, throttle: 1 }),
      flying({ velocity: { x: 500, y: -500, z: -100 }, yawRate: 5 }),
      flying({ position: { x: 0, y: 0, z: 9000 }, brakes: true }),
      flying({ stalled: true, flaps: 30 * DEGREE }),
    ];
    for (const state of states) {
      const lines = drawGame(state, VIEW);
      expect(lines).toHaveLength(SCREEN_ROWS);
      for (const line of lines) {
        expect(line).toHaveLength(SCREEN_COLUMNS);
        expect(line).toMatch(PRINTABLE_ASCII);
      }
    }
  });

  it("names every instrument", () => {
    const top = panel(flying())[1];
    for (const name of [
      "AIRSPEED",
      "ATTITUDE",
      "ALTITUDE",
      "TURN",
      "HEADING",
      "VERT SPEED",
      "ENGINE",
    ]) {
      expect(top).toContain(name);
    }
  });

  it("shows airspeed in knots", () => {
    expect(instrument(panel(flying()), 0)).toMatch(/\b97\b[\s\S]*KNOTS/);
  });

  it("shows height above the Airport in feet", () => {
    expect(instrument(panel(flying()), 2)).toMatch(/\b980\b[\s\S]*FEET/);
  });

  it("shows the heading and its compass point", () => {
    const north = instrument(panel(flying()), 4);
    expect(north).toContain("000");
    expect(north).toMatch(/W\.\|\.\|\.N\.\|\.\|\.E/);
    expect(instrument(panel(flying({ heading: 270 * DEGREE })), 4)).toContain(
      "270",
    );
  });

  it("shows vertical speed in feet per minute", () => {
    expect(instrument(panel(flying()), 5)).toMatch(
      /\+500[\s\S]*FT\/MIN[\s\S]*CLIMB/,
    );
    const sinking = flying({ velocity: { x: 0, y: 50, z: -2.54 } });
    expect(instrument(panel(sinking), 5)).toMatch(/-500[\s\S]*SINK/);
  });

  it("shows RPM, throttle, flaps and brakes", () => {
    const engine = instrument(panel(flying()), 6);
    expect(engine).toMatch(/RPM\s+1840/);
    expect(engine).toContain("THR [#####-----] 50%");
    expect(engine).toContain("FLAPS  UP");
    expect(engine).toContain("BRAKES OFF");
    expect(instrument(panel(flying({ brakes: true })), 6)).toContain(
      "BRAKES ON",
    );
  });

  it("shows the flaps setting in degrees", () => {
    const flaps = instrument(panel(flying({ flaps: 20 * DEGREE })), 6);
    expect(flaps).toContain("FLAPS  20");
  });

  it("shows [STALL] only while the Stall flag is set", () => {
    const stalled = panel(flying({ stalled: true })).join("\n");
    expect(stalled).toContain("[STALL]");
    const flyingOn = panel(flying({ stalled: false })).join("\n");
    expect(flyingOn).not.toContain("STALL");
  });

  it("shows pitch and bank on the attitude indicator", () => {
    const level = instrument(panel(flying()), 1);
    expect(level).toContain("P   0 B   0");
    // Level flight: the horizon runs straight through the Plane symbol's row.
    expect(level).toMatch(/------o------/);

    const noseUpRightBank = instrument(
      panel(flying({ pitch: 10 * DEGREE, roll: 20 * DEGREE })),
      1,
    );
    expect(noseUpRightBank).toContain("P +10 BR 20");

    const leftBank = instrument(panel(flying({ roll: -30 * DEGREE })), 1);
    expect(leftBank).toContain("BL 30");
  });

  it("moves the horizon down when the nose is up, and tilts it with the bank", () => {
    const rows = (state: GameState): string[] =>
      instrument(panel(state), 1)
        .split("\n")
        .slice(2, 9)
        .map((row) => row.slice(1, 14));
    const groundRows = (lines: readonly string[]): number =>
      lines.filter((line) => line.includes(":")).length;
    expect(groundRows(rows(flying({ pitch: 10 * DEGREE })))).toBeLessThan(
      groundRows(rows(flying())),
    );
    // Banked right, the ground rises on the right: more ground at the right end of the top half.
    const banked = rows(flying({ roll: 30 * DEGREE }));
    const right = banked.filter((line) => line.endsWith(":")).length;
    const left = banked.filter((line) => line.startsWith(":")).length;
    expect(right).toBeGreaterThan(left);
  });

  it("shows the turn rate and moves the marker the way the Plane turns", () => {
    const level = instrument(panel(flying()), 3);
    expect(level).toContain("0.0 DEG/S");
    const standardRight = instrument(panel(flying({ yawRate: 3 * DEGREE })), 3);
    expect(standardRight).toContain("3.0 DEG/S");
    const markerColumn = (text: string): number =>
      text
        .split("\n")
        .find((line) => line.includes("^"))
        ?.indexOf("^") ?? -1;
    const tickColumn = (text: string): number =>
      text
        .split("\n")
        .find((line) => line.includes("|-"))
        ?.lastIndexOf("'") ?? -1;
    expect(markerColumn(standardRight)).toBe(tickColumn(standardRight));
    expect(
      markerColumn(instrument(panel(flying({ yawRate: -3 * DEGREE })), 3)),
    ).toBeLessThan(markerColumn(level));
  });

  it("moves the slip ball with the sideslip", () => {
    const ballColumn = (state: GameState): number =>
      instrument(panel(state), 3)
        .split("\n")
        .find((line) => line.includes("(") && line.includes(")"))
        ?.indexOf("o") ?? -1;
    const centred = ballColumn(flying());
    // Airflow coming from the right of the nose.
    expect(
      ballColumn(flying({ velocity: { x: 5, y: 50, z: 0 } })),
    ).toBeGreaterThan(centred);
  });
});
