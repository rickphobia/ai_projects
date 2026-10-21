import { airflow, bodyAxes } from "../flight/attitude";
import type { Plane } from "../flight/plane";
import type { World } from "../world/world";
import {
  DEGREES_PER_RADIAN,
  FEET_PER_METRE,
  KNOTS_PER_METRE_PER_SECOND,
} from "./cockpit-units";
import { SCREEN_COLUMNS, SCREEN_ROWS, VIEW_ROWS } from "./screen-size";

/** Each flight instrument is a box this wide; the engine box takes the rest of the row. */
const INSTRUMENT_WIDTH = 16;
const ENGINE_WIDTH = SCREEN_COLUMNS - 2 - 6 * INSTRUMENT_WIDTH;
/** Rows inside the panel's outer frame, and inside each box. */
const PANEL_INNER_ROWS = SCREEN_ROWS - VIEW_ROWS - 2;
const BOX_INNER_ROWS = PANEL_INNER_ROWS - 2;

/** The airspeed bar is full at this many knots. */
const AIRSPEED_BAR_FULL = 160;
/** The attitude indicator moves the horizon one row per this many degrees of pitch. */
const DEGREES_PER_ATTITUDE_ROW = 5;
/** A standard-rate turn, 3 degrees a second, puts the turn marker on its tick. */
const STANDARD_RATE = 3;
/** The slip ball moves one column per this many degrees of sideslip. */
const DEGREES_PER_BALL_COLUMN = 2;
/** The heading tape shows this many degrees per column. */
const DEGREES_PER_HEADING_COLUMN = 15;

/**
 * The flight model has no engine, so RPM is shown from the throttle, plus a little windmilling
 * from the airflow, between a C172's idle and redline.
 */
const IDLE_RPM = 700;
const FULL_THROTTLE_RPM = 2400;
const WINDMILL_RPM_PER_KNOT = 3;
const REDLINE_RPM = 2700;

/** The Instrument panel: the glareshield with the stall warning, the six flight instruments and the engine box, framed. */
export function drawInstrumentPanel(plane: Plane, world: World): string[] {
  const axes = bodyAxes(plane);
  const air = airflow(plane.velocity, axes);
  const knots = air.speed * KNOTS_PER_METRE_PER_SECOND;
  const boxes = [
    box("AIRSPEED", INSTRUMENT_WIDTH, airspeed(knots)),
    box("ATTITUDE", INSTRUMENT_WIDTH, attitude(plane)),
    box("ALTITUDE", INSTRUMENT_WIDTH, altitude(plane, world)),
    box("TURN", INSTRUMENT_WIDTH, turnCoordinator(plane, air.sideslip)),
    box("HEADING", INSTRUMENT_WIDTH, heading(plane.heading)),
    box("VERT SPEED", INSTRUMENT_WIDTH, verticalSpeed(plane.velocity.z)),
    box("ENGINE", ENGINE_WIDTH, engine(plane, knots)),
  ];
  // The stall warning sits in the middle of the glareshield, right under the pilot's view.
  const lines = [centre(plane.stalled ? " [STALL] " : "", SCREEN_COLUMNS, "=")];
  for (let row = 0; row < PANEL_INNER_ROWS; row++) {
    lines.push(`|${boxes.map((lines) => lines[row] ?? "").join("")}|`);
  }
  lines.push(`+${"-".repeat(SCREEN_COLUMNS - 2)}+`);
  return lines;
}

/** A bordered box with its title in the top edge and the given lines centred inside. */
function box(
  title: string,
  width: number,
  content: readonly string[],
): string[] {
  const inner = width - 2;
  const top = Math.floor((BOX_INNER_ROWS - content.length) / 2);
  const lines = [`+${centre(` ${title} `, inner, "-")}+`];
  for (let row = 0; row < BOX_INNER_ROWS; row++) {
    lines.push(`|${centre(content[row - top] ?? "", inner)}|`);
  }
  lines.push(`+${"-".repeat(inner)}+`);
  return lines;
}

function centre(text: string, width: number, fill = " "): string {
  const shown = text.slice(0, width);
  const left = Math.floor((width - shown.length) / 2);
  return fill.repeat(left) + shown + fill.repeat(width - left - shown.length);
}

function airspeed(knots: number): string[] {
  const barWidth = 10;
  const filled = clamp(
    Math.round((knots / AIRSPEED_BAR_FULL) * barWidth),
    0,
    barWidth,
  );
  return [
    String(Math.round(knots)),
    "KNOTS",
    "",
    `[${"#".repeat(filled)}${"-".repeat(barWidth - filled)}]`,
  ];
}

/**
 * A horizon seen from the pilot's seat: ground below it, sky above. Nose up moves it down; a
 * right bank tilts it so the right side rises. The `-o-` in the middle is the Plane.
 */
function attitude(plane: Plane): string[] {
  const columns = 13;
  const rows = 7;
  const pitchRows =
    (plane.pitch * DEGREES_PER_RADIAN) / DEGREES_PER_ATTITUDE_ROW;
  const sinRoll = Math.sin(plane.roll);
  const cosRoll = Math.cos(plane.roll);
  const lines: string[] = [];
  for (let row = 0; row < rows; row++) {
    let line = "";
    for (let column = 0; column < columns; column++) {
      // Cells are about twice as tall as wide, so a column counts as half a row.
      const across = (column - (columns - 1) / 2) / 2;
      const up = (rows - 1) / 2 - row;
      const aboveHorizon = (up + pitchRows) * cosRoll - across * sinRoll;
      line += Math.abs(aboveHorizon) < 0.5 ? "-" : aboveHorizon < 0 ? ":" : " ";
    }
    if (row === (rows - 1) / 2) line = line.slice(0, 5) + "-o-" + line.slice(8);
    lines.push(line);
  }
  const pitch = Math.round(plane.pitch * DEGREES_PER_RADIAN);
  const bank = Math.round(plane.roll * DEGREES_PER_RADIAN);
  const bankSide = bank > 0 ? "R" : bank < 0 ? "L" : " ";
  lines.push(
    `P${signed(pitch).padStart(4)} B${bankSide}${String(Math.abs(bank)).padStart(3)}`,
  );
  return lines;
}

function altitude(plane: Plane, world: World): string[] {
  const feet = (plane.position.z - world.runway.elevation) * FEET_PER_METRE;
  return [String(Math.round(feet / 10) * 10), "FEET", "", "ABOVE AIRPORT"];
}

/** How fast the heading is changing, a little Plane that leans with it, and the slip ball. */
function turnCoordinator(plane: Plane, sideslip: number): string[] {
  const rate = turnRate(plane) * DEGREES_PER_RADIAN;
  const scaleWidth = 13;
  const middle = (scaleWidth - 1) / 2;
  const tick = 4;
  const scale = Array.from({ length: scaleWidth }, () => "-");
  scale[middle] = "|";
  scale[middle - tick] = "'";
  scale[middle + tick] = "'";
  const marker = clamp(
    Math.round(middle + (rate / STANDARD_RATE) * tick),
    0,
    scaleWidth - 1,
  );
  const ballTravel = 3;
  const ball = clamp(
    Math.round((sideslip * DEGREES_PER_RADIAN) / DEGREES_PER_BALL_COLUMN),
    -ballTravel,
    ballTravel,
  );
  const tube = Array.from({ length: 2 * ballTravel + 1 }, () => " ");
  tube[ballTravel + ball] = "o";
  return [
    scale.join(""),
    " ".repeat(marker) + "^" + " ".repeat(scaleWidth - 1 - marker),
    "",
    `(${tube.join("")})`,
    "",
    `${rate.toFixed(1)} DEG/S`,
  ];
}

/** The heading's change per second, from the Plane's body rates. */
function turnRate(plane: Plane): number {
  const aroundRoof =
    plane.pitchRate * Math.sin(plane.roll) +
    plane.yawRate * Math.cos(plane.roll);
  return aroundRoof / Math.cos(plane.pitch);
}

/** The heading in degrees and a compass tape centred on it, with a marker over the middle. */
function heading(radians: number): string[] {
  const degrees =
    ((Math.round(radians * DEGREES_PER_RADIAN) % 360) + 360) % 360;
  const half = 6;
  let tape = "";
  for (let column = -half; column <= half; column++) {
    tape += compassMark(degrees + column * DEGREES_PER_HEADING_COLUMN);
  }
  return [String(degrees).padStart(3, "0"), "", "v", tape];
}

function compassMark(degrees: number): string {
  const step =
    Math.round(degrees / DEGREES_PER_HEADING_COLUMN) *
    DEGREES_PER_HEADING_COLUMN;
  const wrapped = ((step % 360) + 360) % 360;
  const cardinal = { 0: "N", 90: "E", 180: "S", 270: "W" }[wrapped];
  if (cardinal !== undefined) return cardinal;
  return wrapped % 30 === 0 ? "|" : ".";
}

function verticalSpeed(metresPerSecond: number): string[] {
  const feetPerMinute =
    Math.round((metresPerSecond * FEET_PER_METRE * 60) / 10) * 10;
  const direction =
    feetPerMinute > 0 ? "^ CLIMB" : feetPerMinute < 0 ? "v SINK" : "- LEVEL";
  return [signed(feetPerMinute), "FT/MIN", "", direction];
}

/** RPM, the throttle as a bar, the flaps and the brakes. */
function engine(plane: Plane, knots: number): string[] {
  const rpm = clamp(
    IDLE_RPM +
      plane.throttle * (FULL_THROTTLE_RPM - IDLE_RPM) +
      knots * WINDMILL_RPM_PER_KNOT,
    0,
    REDLINE_RPM,
  );
  const barWidth = 10;
  const filled = Math.round(plane.throttle * barWidth);
  const percent = Math.round(plane.throttle * 100);
  return [
    `RPM    ${String(Math.round(rpm / 10) * 10).padStart(4)}`.padEnd(18),
    `THR [${"#".repeat(filled)}${"-".repeat(barWidth - filled)}]${String(percent).padStart(3)}%`,
    "",
    `FLAPS  ${flapsSetting(plane.flaps)}`.padEnd(18),
    `BRAKES ${plane.brakes ? "ON" : "OFF"}`.padEnd(18),
  ];
}

function flapsSetting(radians: number): string {
  const degrees = Math.round(radians * DEGREES_PER_RADIAN);
  return degrees === 0 ? "UP" : String(degrees);
}

function signed(value: number): string {
  return value > 0 ? `+${String(value)}` : String(value);
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}
