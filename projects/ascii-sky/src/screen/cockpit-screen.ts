import type { BrightnessGrid } from "./brightness-grid";
import { rampCharacter } from "./character-ramp";
import {
  SCREEN_COLUMNS,
  SCREEN_ROWS,
  VIEW_COLUMNS,
  VIEW_ROWS,
} from "./screen-size";

/** Draw was handed a brightness grid that doesn't match the view area: a bug in the view adapter. */
export class CockpitScreenError extends Error {
  override name = "CockpitScreenError";
}

/** The window pillars: this many columns of this character at each side of the view. */
const PILLAR = "|";
const PILLAR_WIDTH = 2;
/** Half the cowling's width in columns, and how many rows it rises into the view at its centre. */
const COWLING_HALF_WIDTH = 34;
const COWLING_HEIGHT = 4.5;
/** Where the cowling outline is steeper than this many rows per column, draw a slope, not a dash. */
const STEEP = 0.7;

/**
 * The Screen in the Cockpit view: the World as Character ramp characters, with the window
 * frame and the top of the nose cowling drawn over it, and the Instrument panel area below.
 */
export function drawCockpitScreen(view: BrightnessGrid): string[] {
  checkGrid(view);
  const cells: string[][] = [];
  for (let row = 0; row < VIEW_ROWS; row++) {
    const line: string[] = [];
    for (let column = 0; column < VIEW_COLUMNS; column++) {
      line.push(rampCharacter(view.values[row * VIEW_COLUMNS + column] ?? 0));
    }
    cells.push(line);
  }
  drawCowling(cells);
  drawWindowFrame(cells);
  return [...cells.map((line) => line.join("")), ...instrumentPanelArea()];
}

function checkGrid(view: BrightnessGrid): void {
  const expected = VIEW_COLUMNS * VIEW_ROWS;
  if (
    view.columns !== VIEW_COLUMNS ||
    view.rows !== VIEW_ROWS ||
    view.values.length !== expected
  ) {
    throw new CockpitScreenError(
      `expected a ${String(VIEW_COLUMNS)}x${String(VIEW_ROWS)} brightness grid, got ${String(view.columns)}x${String(view.rows)} with ${String(view.values.length)} values`,
    );
  }
}

function drawWindowFrame(cells: string[][]): void {
  cells[0]?.fill("=");
  for (let row = 1; row < VIEW_ROWS; row++) {
    const line = cells[row];
    if (line === undefined) continue;
    line.fill(PILLAR, 0, PILLAR_WIDTH);
    line.fill(PILLAR, VIEW_COLUMNS - PILLAR_WIDTH);
  }
}

/** Half an ellipse rising from the bottom of the view: dark below its outline. */
function drawCowling(cells: string[][]): void {
  for (let column = 0; column < VIEW_COLUMNS; column++) {
    const top = cowlingTop(column);
    if (top === undefined) continue;
    const outlineRow = Math.floor(top);
    for (let row = outlineRow; row < VIEW_ROWS; row++) {
      const line = cells[row];
      if (line === undefined) continue;
      line[column] = row === outlineRow ? outlineCharacter(column, top) : " ";
    }
  }
}

/** The row (with its fraction) where the cowling's outline crosses a column, if it does. */
function cowlingTop(column: number): number | undefined {
  const across = (column + 0.5 - VIEW_COLUMNS / 2) / COWLING_HALF_WIDTH;
  if (Math.abs(across) >= 1) return undefined;
  return VIEW_ROWS - COWLING_HEIGHT * Math.sqrt(1 - across * across);
}

function outlineCharacter(column: number, top: number): string {
  const left = cowlingTop(column - 1) ?? VIEW_ROWS;
  const right = cowlingTop(column + 1) ?? VIEW_ROWS;
  const slope = (right - left) / 2;
  if (slope < -STEEP) return "/";
  if (slope > STEEP) return "\\";
  // Pick the character whose stroke sits where the outline crosses the cell.
  const withinCell = top - Math.floor(top);
  if (withinCell < 1 / 3) return "'";
  if (withinCell < 2 / 3) return "-";
  return "_";
}

/** The glareshield and an empty box where the Instrument panel will go. */
function instrumentPanelArea(): string[] {
  const panelRows = SCREEN_ROWS - VIEW_ROWS;
  const lines = ["=".repeat(SCREEN_COLUMNS)];
  for (let row = 1; row < panelRows - 1; row++) {
    lines.push(`|${" ".repeat(SCREEN_COLUMNS - 2)}|`);
  }
  lines.push(`+${"-".repeat(SCREEN_COLUMNS - 2)}+`);
  return lines;
}
