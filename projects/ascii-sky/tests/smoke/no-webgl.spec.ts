import { expect, test } from "@playwright/test";
import { collectErrors, readScreen, SCREEN_ROWS } from "./read-screen";

// Replaces the config's launch flags: this browser has no WebGL at all.
test.use({
  launchOptions: { args: ["--disable-webgl", "--disable-3d-apis"] },
});

test("says in plain ASCII that WebGL is missing, and logs it", async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto("./");
  const lines = await readScreen(page);

  expect(lines).toHaveLength(SCREEN_ROWS);
  expect(lines.join("\n")).toContain("needs WebGL");
  expect(errors.some((text) => text.includes("3D view could not start"))).toBe(
    true,
  );
});
