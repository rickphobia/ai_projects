import { defineConfig } from "vitest/config";

// The backend `uv run rss-news serve` listens here while `npm run dev` serves the PWA.
const backend = "http://127.0.0.1:8000/ai-projects/rss-news";

export default defineConfig({
  // Relative asset paths, so the build works under any prefix, like /ai-projects/rss-news/.
  base: "./",
  server: {
    proxy: {
      "/healthz": { target: backend, changeOrigin: true },
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "jsdom",
  },
});
