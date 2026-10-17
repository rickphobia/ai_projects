import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import { loadConfig } from "./src/config.ts";

const test = {
  include: ["tests/**/*.test.ts"],
  environment: "node",
};

export default defineConfig(({ mode }) => {
  // Tests don't serve pages, so they don't need a .env.
  if (mode === "test") return { test };
  // Validate here too, so a bad .env fails the build instead of shipping a blank page.
  const config = loadConfig(loadEnv(mode, ".", "VITE_"));
  return {
    base: config.basePath,
    // PixiJS is about 600 kB minified before gzip, accepted in decision 0001; warn only well past that.
    build: { chunkSizeWarningLimit: 900 },
    test,
  };
});
