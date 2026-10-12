import { expect, type Page } from "@playwright/test";

export const SCREEN_COLUMNS = 120;
export const SCREEN_ROWS = 45;

/** The Screen's lines, once the page has drawn something into it. */
export async function readScreen(page: Page): Promise<string[]> {
  const screen = page.locator("#screen");
  await expect(screen).not.toBeEmpty();
  return (await screen.textContent())?.split("\n") ?? [];
}

/** Collects every console error and uncaught exception the page raises. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}
