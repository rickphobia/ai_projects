# 01: Walking skeleton

**What to build:** A new developer can clone the repo, follow the README, and get rss-news running locally and in Docker: the FastAPI backend answers `/healthz` and serves an empty PWA under `/ai-projects/rss-news/`. Settings are validated at startup, logs are structured, and lint, type checks, tests and the Docker smoke test run locally and in CI. Follows decision 0002 and court-booker's skeleton.

**Blocked by:** None (can start immediately)

**Status:** done

**Touches:** config, web/app, pwa/shell, docker, ci

**Effort:** medium

- [x] Python project managed with `uv`, pinned Python version, committed lock file; `ruff` (lint and format), `mypy --strict` and `pytest` configured
- [x] PWA project with Vite and TypeScript in strict mode, committed lock file; `eslint`, `prettier`, `tsc` and Vitest configured, with one passing screen test against a fake API client
- [x] Config module loads the settings this ticket uses (path prefix, database path, log level, time zone) from environment variables and fails at startup with a message naming the bad or missing variable; `.env.example` lists every variable with dummy values
- [x] JSON-lines logger on stdout with a configurable level
- [x] FastAPI app under the path prefix serves the built PWA and an unauthenticated `/healthz` that reports the database is reachable
- [x] Thin entrypoint with a `serve` subcommand
- [x] Multi-stage Dockerfile (Node stage builds the PWA, Python stage runs the app) with pinned base images
- [x] Docker smoke test script builds the image, starts it with dummy settings, checks `/healthz` and that the PWA loads under the prefix, and checks the container uses under 300MB of RAM
- [x] `.github/workflows/rss-news.yml` (`name: rss-news`, `paths:` scoped to the project) runs ruff, mypy, pytest, eslint, prettier, tsc, Vitest and the smoke test, and is green
- [x] `.claude/settings.json` copied from the root
- [x] README filled in from the template: install, configure, run, test, Docker, config table, folder layout; status `in progress`
- [x] Project added to the index in the root README
