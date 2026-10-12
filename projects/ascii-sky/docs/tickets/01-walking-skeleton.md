# 01: Walking skeleton

**What to build:** the project exists and runs end to end. Opening `/ai-projects/ascii-sky/` shows a 120×45 Screen of placeholder ASCII text, light grey on black, scaled to fit the window while keeping its shape. Lint, format check, type checks, one unit test and the build run in CI on every push, and PRs get a preview on the Beelink. This is the base every other ticket builds on (see `docs/new-project.md`).

**Blocked by:** None (can start immediately)

**Status:** done

**Touches:** project setup, config, logging, adapters/screen, entrypoint, CI, deploy, scripts/try-pr.sh, root README

**Effort:** medium

- [x] TypeScript (`strict`), Vite, ESLint, Prettier and Vitest set up with pinned versions and a committed lock file, matching pawn-swarm's scripts (`check` runs lint, format check, type checks and tests)
- [x] Config module reads the base path and a debug flag from Vite environment variables, validated at start-up; `.env.example` lists them
- [x] A levelled logger over the browser console logs start-up (build version, Screen size)
- [x] The Screen adapter writes exactly 45 lines of 120 characters into one `<pre>`, scaled with CSS to fit the window without stretching or wrapping
- [x] One unit test passes, covering the placeholder Screen text (45 lines × 120 printable ASCII characters)
- [x] `.github/workflows/ascii-sky.yml` (`name: ascii-sky`, scoped to `projects/ascii-sky/**`) runs lint, format check, type checks, tests and the build, and is green
- [x] `.claude/settings.json` copied from the root
- [x] `deploy/update-site.sh` and `deploy/rollback.sh` follow pawn-swarm's pattern; the project is added to `web_projects` and `build_web` in `scripts/try-pr.sh`
- [x] README (from the template) covers install, configure, run, test and deploy; the project row is added to the root README index

**Owner steps:** run `deploy/update-site.sh` on the Beelink after merging to publish the first version.
