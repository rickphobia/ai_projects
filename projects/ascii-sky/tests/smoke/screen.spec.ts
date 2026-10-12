import { expect, test } from "@playwright/test";
import { COWLING_HEIGHT, PILLAR_WIDTH } from "../../src/screen/cockpit-screen";
import {
  PRINTABLE_ASCII,
  SCREEN_COLUMNS,
  SCREEN_ROWS,
  VIEW_ROWS,
} from "../../src/screen/screen-size";
import { collectErrors, readScreen } from "./read-screen";

/** The Cockpit view inside the window frame and above the cowling: only the World shows here. */
const WORLD_ROWS = { first: 1, end: VIEW_ROWS - Math.ceil(COWLING_HEIGHT) };
const WORLD_COLUMNS = {
  first: PILLAR_WIDTH,
  end: SCREEN_COLUMNS - PILLAR_WIDTH,
};

test("shows the World from the Runway on a full Screen", async ({ page }) => {
  const errors = collectErrors(page);

  await page.goto("./");
  const lines = await readScreen(page);

  expect(lines).toHaveLength(SCREEN_ROWS);
  for (const line of lines) {
    expect(line).toHaveLength(SCREEN_COLUMNS);
    expect(line).toMatch(PRINTABLE_ASCII);
  }
  const world = lines
    .slice(WORLD_ROWS.first, WORLD_ROWS.end)
    .map((line) => line.slice(WORLD_COLUMNS.first, WORLD_COLUMNS.end))
    .join("");
  // Not blank: the sky, the ground and the Runway give at least three different characters.
  expect(new Set(world).size).toBeGreaterThanOrEqual(3);
  expect(errors).toEqual([]);
});
