import { expect, test } from "@playwright/test";
import {
  collectErrors,
  readScreen,
  SCREEN_COLUMNS,
  SCREEN_ROWS,
} from "./read-screen";

/** The Cockpit view's rows inside the window frame, above the cowling. */
const VIEW_INSIDE_FRAME = { firstRow: 1, lastRow: 26, firstColumn: 2 };

test("shows the World from the Runway on a full Screen", async ({ page }) => {
  const errors = collectErrors(page);

  await page.goto("./");
  const lines = await readScreen(page);

  expect(lines).toHaveLength(SCREEN_ROWS);
  for (const line of lines) {
    expect(line).toHaveLength(SCREEN_COLUMNS);
    expect(line).toMatch(/^[\x20-\x7e]*$/);
  }
  const view = lines
    .slice(VIEW_INSIDE_FRAME.firstRow, VIEW_INSIDE_FRAME.lastRow + 1)
    .map((line) =>
      line.slice(
        VIEW_INSIDE_FRAME.firstColumn,
        SCREEN_COLUMNS - VIEW_INSIDE_FRAME.firstColumn,
      ),
    )
    .join("");
  // Not blank: the sky, the ground and the Runway give at least three different characters.
  expect(new Set(view).size).toBeGreaterThanOrEqual(3);
  expect(errors).toEqual([]);
});
