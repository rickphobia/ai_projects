# ASCII Sky

A browser flight simulator where everything on the Screen, the 3D World included, is drawn with printable ASCII characters, light grey on black. Anyone with a link and a keyboard can play it at `https://rickphobia.com/ai-projects/ascii-sky/`.

## Status

`in progress`: the walking skeleton. The page shows a 120×45 placeholder Screen scaled to fit the window; flying comes in the next tickets (`docs/tickets/`).

## Requirements

- Node.js 22.22.0 (the version in `.nvmrc`; `nvm use` picks it up) and npm
- A browser with JavaScript

No accounts or API keys.

## Setup

```bash
cd projects/ascii-sky
npm ci
cp .env.example .env   # the example values work as they are
```

## Run

```bash
npm run dev       # dev server with reload, at the URL it prints
npm run build     # static build in dist/
npm run preview   # serve dist/ to check the build
```

## Test

```bash
npm run check     # lint, format check, type check and unit tests: what CI runs
npm run test      # unit tests only
npm run format    # fix formatting
```

CI (`.github/workflows/ascii-sky.yml`) runs `npm run check`, the build and `shellcheck deploy/*.sh` on every push that touches this project.

## Configuration

Read from `.env` at build time (Vite bakes `VITE_*` variables into the page) and validated in `src/config.ts`. `vite.config.ts` validates them too, so a bad value fails the build instead of shipping a blank page.

| Variable | Required | What it does |
|----------|----------|--------------|
| `VITE_BASE_PATH` | yes | Where the site is served from. `./` (the default) works from any folder, so the live site and PR previews use the same build. An absolute path must start and end with `/`. |
| `VITE_DEBUG` | yes | `true` logs at debug level in the browser console; `false` logs info and above. |
| `VITE_BUILD_VERSION` | no | Names the build in the start-up log. `deploy/update-site.sh` sets it to the commit, `scripts/try-pr.sh` to the PR and commit; otherwise `dev`. |

The deploy scripts read their own `ASCII_SKY_*` variables from the shell; see "Deploy".

## How it works

- `src/main.ts` is the entrypoint: it loads the config, makes the logger, and shows a Screen.
- `src/screen/` holds the Screen's size (120 columns × 45 rows) and the text drawn on it. For now that is the placeholder Screen and a framed message for start-up errors.
- `src/adapters/screen/screen-output.ts` writes the 45 lines into one `<pre>`. It refuses anything that isn't 45 lines of 120 printable ASCII characters. The `<pre>` is laid out at its natural size and scaled with a CSS transform to fit the window, so it keeps its shape and never wraps.

`docs/spec.md` describes where this is going: a pure Game core (Advance and Draw), a three.js view adapter, keyboard and audio adapters.

## Folder layout

```
src/
  main.ts            entrypoint: wires config, logger and adapters
  config.ts          reads and validates VITE_* settings
  logger.ts          levelled logger over the browser console
  screen/            Screen size and the text drawn on it
  adapters/screen/   writes the Screen into the page
tests/               mirrors src/
deploy/              update-site.sh and rollback.sh for the Beelink
docs/                spec, tickets, decisions
```

## Debugging

- Logs go to the browser console, prefixed `[ascii-sky]`. Start-up logs the build version and Screen size at `info`.
- Add `?debug=1` to the page URL for debug-level logs without a rebuild, or set `VITE_DEBUG=true` and rebuild.
- If start-up fails (a bad setting in a dev build, say), the Screen shows "ASCII SKY could not start." with the reason, and the console has the error.
- A blank page with no log usually means the JS bundle didn't load: check the network tab for a 404 and that `VITE_BASE_PATH` matches where the page is served.

## Deploy

The game is a static site, served at `https://rickphobia.com/ai-projects/ascii-sky/` by nginx in Docker on the Beelink, with `~/homelab/html` as the site root. GitHub can't reach the home network, so the server pulls: you run one script there.

`deploy/update-site.sh` fetches `main` into `~/homelab/dev/ai_slops`, builds in a pinned `node` Docker image (no Node install needed on the server), copies the result to `~/homelab/html/ai-projects/ascii-sky.new`, then renames it into place. The old build stays as `ascii-sky.previous`. If any step fails, the script exits non-zero, names the step, and the live site stays as it was. If `main` hasn't moved since the last deploy, it does nothing.

### First-time setup (on the Beelink)

Needs `git`, `docker` (your user can run it without sudo) and `flock` (part of `util-linux`, already on Ubuntu). The clone is shared with the other projects, so skip it if `~/homelab/dev/ai_slops` exists.

```bash
mkdir -p ~/homelab/dev && git clone https://github.com/rickphobia/ai_slops.git ~/homelab/dev/ai_slops
~/homelab/dev/ai_slops/projects/ascii-sky/deploy/update-site.sh
```

No nginx change is needed: `/ai-projects/` is already served from `~/homelab/html/ai-projects/` (see pawn-swarm's README).

### Update

```bash
~/homelab/dev/ai_slops/projects/ascii-sky/deploy/update-site.sh
```

To rebuild even though `main` hasn't changed: `ASCII_SKY_FORCE=1 ~/homelab/dev/ai_slops/projects/ascii-sky/deploy/update-site.sh`.

Settings (all optional, shown with defaults in `.env.example`) are environment variables: `ASCII_SKY_REPO_URL`, `ASCII_SKY_BRANCH`, `ASCII_SKY_SRC_DIR`, `ASCII_SKY_SITE_ROOT`, `ASCII_SKY_SITE_SUBPATH`, `ASCII_SKY_NODE_IMAGE`, `ASCII_SKY_FORCE`. The scripts do not read `.env`.

### Roll back

```bash
~/homelab/dev/ai_slops/projects/ascii-sky/deploy/rollback.sh
```

Swaps `ascii-sky` and `ascii-sky.previous`. Run it again to undo. The next `update-site.sh` run puts the latest `main` back.

### Check that it worked

```bash
curl -I https://rickphobia.com/ai-projects/ascii-sky/   # expect HTTP 200
cat ~/homelab/dev/ascii-sky.deployed-commit            # the commit that is live
```

Then open the URL: the console's start-up line shows the same commit.

### PR previews

`scripts/try-pr.sh <PR number>` builds a PR on the Beelink and serves it; the preview timer does this for every open PR (see "Previews on the Beelink" in `docs/workflow.md`).

## Decisions

See `docs/decisions/` for why things are the way they are.
