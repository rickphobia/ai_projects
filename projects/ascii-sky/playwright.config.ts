import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

/** The smoke test: loads the built page (run `npm run build` first) in headless Chromium. */
export default defineConfig({
  testDir: "tests/smoke",
  forbidOnly: true,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${String(PORT)}/`,
    launchOptions: {
      // Headless Chromium has no GPU; this lets WebGL fall back to its software renderer.
      args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
    },
  },
  webServer: {
    command: `npx vite preview --port ${String(PORT)} --strictPort`,
    url: `http://localhost:${String(PORT)}/`,
    reuseExistingServer: true,
  },
});
