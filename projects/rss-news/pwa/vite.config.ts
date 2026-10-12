import { defineConfig } from "vitest/config";

// The backend `uv run rss-news serve` listens here while `npm run dev` serves the PWA.
const backend = "http://127.0.0.1:8000/ai-projects/rss-news";

export default defineConfig({
  // Relative asset paths, so the build works under any prefix, like /ai-projects/rss-news/.
  base: "./",
  // A new value each build changes sw.js, which is how the browser learns of a new release.
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  plugins: [
    {
      // The service worker is a classic script and can't load chunks: fail the build rather
      // than ship a worker that never starts.
      name: "self-contained-service-worker",
      generateBundle(_, bundle) {
        const worker = bundle["sw.js"];
        if (worker?.type === "chunk" && worker.imports.length > 0) {
          this.error(
            `sw.js imports ${worker.imports.join(", ")}: the service worker must not import modules the app also imports`,
          );
        }
      },
    },
  ],
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
