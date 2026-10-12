import { defineConfig } from "vitest/config";

// The backend `uv run rss-news serve` listens here while `npm run dev` serves the PWA.
const backend = "http://127.0.0.1:8000/ai-projects/rss-news";

export default defineConfig({
  // Relative asset paths, so the build works under any prefix, like /ai-projects/rss-news/.
  base: "./",
  // A new value each build changes sw.js, which is how the browser learns of a new release.
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  build: {
    rollupOptions: {
      input: { main: "index.html", sw: "src/pwa/service-worker.ts" },
      output: {
        // The worker keeps a fixed name at the root of the build, so its scope is the whole app.
        entryFileNames: (chunk) =>
          chunk.name === "sw" ? "sw.js" : "assets/[name]-[hash].js",
      },
    },
  },
  server: {
    proxy: {
      "/healthz": { target: backend, changeOrigin: true },
      "/api": { target: backend, changeOrigin: true },
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "jsdom",
  },
});
