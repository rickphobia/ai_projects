# 01: Walking skeleton, live on the site

**What to build:** A new developer can clone the repo, run the commands in the README, and see the empty 20×14 Board in the browser, drawn with PixiJS. Lint, format, type checks, tests and the build run locally and in CI. The same build can be deployed to `rickphobia.com/ai-projects/against-all-tod/`, zipped for itch.io, and served as a Beelink PR preview.

**Blocked by:** None (can start immediately)

**Status:** ready

**Touches:** project-setup, ci, config, logger, main, renderer/board, deploy, scripts/try-pr, README

**Effort:** medium

- [ ] TypeScript (strict), Vite, Vitest, ESLint, Prettier and PixiJS set up with pinned versions and a committed lock file
- [ ] Copy of the root `.claude/settings.json` in the project folder
- [ ] Config module reads its settings (base path, debug flag, default seed), validates them at startup and fails fast with a clear message; `.env.example` lists every variable
- [ ] Level-based logger; `?debug=1` turns on debug level
- [ ] A startup error screen shows a clear message if the game fails to start
- [ ] PixiJS draws the empty 20×14 Board with the Spawn line on the left column and the Goal on the right edge
- [ ] Kenney packs chosen for the top-down look are added with their licence, and listed in a README credits section
- [ ] One passing test (config validation)
- [ ] `.github/workflows/against-all-tod.yml` (`name: against-all-tod`, scoped with `paths:`) runs lint, format check, type check, tests and build, and is green
- [ ] `deploy/update-site.sh` and `deploy/rollback.sh` follow the pawn-swarm pattern; a script or npm command produces an itch.io zip of the build
- [ ] The project is added to `web_projects` and `build_web` in `scripts/try-pr.sh`
- [ ] README filled in from the template (install, run, test, config table, folder layout, Deploy section); root README index row added with status `in progress`

**Owner steps:** run `projects/against-all-tod/deploy/update-site.sh` on the Beelink after merge; create the itch.io page and upload the zip when there is something to play.
