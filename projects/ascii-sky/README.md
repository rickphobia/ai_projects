# ASCII Sky

A browser flight simulator where everything on the Screen, the 3D World included, is drawn with printable ASCII characters, light grey on black. Anyone with a link and a keyboard can play it at `https://rickphobia.com/ai-projects/ascii-sky/`.

## Status

`in progress`: take off and fly. The page opens on a title screen listing every key; any key puts you in the Cockpit view on the Runway, the 3D World drawn in characters on a 120×45 Screen scaled to fit the window. `W`/`S` set the throttle, `B` holds the brakes, `A`/`D` steer on the ground, and the Plane lifts off when fast enough (hold the down arrow to raise the nose). In the air the arrows pitch and roll it, a bank turns it, and the World's edge stops it. Too slow or too nose-high, the Plane Stalls: the nose drops and `[STALL]` shows in the glareshield until the nose is lowered (power helps). `F` steps the flaps through UP, 10, 20 and 30 degrees, lowering the Stall speed and adding drag for a slow approach. `P`/`Esc` (or hiding the tab) pauses. Under the view, the Instrument panel shows airspeed, attitude, altitude, turn rate and slip, heading, vertical speed, RPM, throttle, flaps, brakes and the stall warning. Every Flight ends: a gentle Touchdown (sink rate under 3 m/s, about 590 ft/min, bank under 10°, nose not down) on the Runway is Landed once the Plane rolls to a stop, on grass Landed off-runway; anything harder, or a hill or the lake, is Crashed. A banner shows the result and the Touchdown stats, and `R` starts a new Flight on the Runway. Sound comes in the next ticket (`docs/tickets/`).

## Requirements

- Node.js 22.22.0 (the version in `.nvmrc`; `nvm use` picks it up) and npm
- A browser with JavaScript and WebGL

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

The smoke test loads the built page in headless Chromium and checks the Screen. It needs the build and, once per machine, the browser:

```bash
npx playwright install --only-shell chromium   # once; add --with-deps on a fresh Linux box
npm run build && npm run test:smoke
```

CI (`.github/workflows/ascii-sky.yml`) runs `npm run check`, the build, the smoke test and `shellcheck deploy/*.sh` on every push that touches this project.

## Configuration

Read from `.env` at build time (Vite bakes `VITE_*` variables into the page) and validated in `src/config.ts`. `vite.config.ts` validates them too, so a bad value fails the build instead of shipping a blank page.

| Variable | Required | What it does |
|----------|----------|--------------|
| `VITE_BASE_PATH` | yes | Where the site is served from. `./` (the default) works from any folder, so the live site and PR previews use the same build. An absolute path must start and end with `/`. |
| `VITE_DEBUG` | yes | `true` logs at debug level in the browser console; `false` logs info and above. |
| `VITE_BUILD_VERSION` | no | Names the build in the start-up log. `deploy/update-site.sh` sets it to the commit, `scripts/try-pr.sh` to the PR and commit; otherwise `dev`. |

The deploy scripts read their own `ASCII_SKY_*` variables from the shell; see "Deploy".

## How it works

- `src/main.ts` is the entrypoint: it loads the config, makes the logger and builds the World, then runs a `requestAnimationFrame` loop: read the controls, call Advance, render the World, call Draw, show the Screen. Hiding the tab pauses the game. On a device without a keyboard it shows a message instead.
- `src/game/` is the Game core. `controls.ts` names the actions a player can hold down; `game.ts` holds the game state (phase, the World, the Plane, how the Flight ended) and Advance, which moves it on given the controls and the elapsed time. Advance runs the flight model in fixed 1/120 s steps and carries the leftover time to the next frame, so the same controls over the same time give the same Flight at any frame rate. After each step it asks `flight/touchdown.ts` whether the Flight has ended; once it has, the Plane is frozen until `R`.
- `src/flight/` is the flight model: a light sim of a Cessna-172-like Plane. `tuning.ts` holds the numbers that set how it flies (mass, lift, Stall, flaps, drag, thrust, control rates, damping, wheel friction), so the feel is tuned there without touching the logic. `flight-model.ts` is one step: `forces.ts` (lift, drag, side force, thrust, weight), `wing.ts` (lift and drag coefficients from angle of attack and flaps, and the Stall: past the critical angle the wing keeps only part of its lift until the angle drops a few degrees below it), `control-response.ts` (the controls ease the Plane's turning rates toward a target; the tail keeps the nose near its trimmed angle of attack, the wings drift back toward level, and a Stalled wing drops the nose), `attitude.ts` (the Plane's axes and how body rates turn it) and `ground-roll.ts` (wheels: rolling friction, brakes, nosewheel steering). A bank turns the Plane because the tilted lift bends the flight path and the tail swings the nose after it. The World's edge is a wall 50 m inside the edge. `cockpit-camera.ts` gives the pilot's eye pose from the Plane. `touchdown.ts` holds the ending rules: it records the Touchdown stats (sink rate, speed and bank from the step before the wheels touch, distance from the Runway centreline) and decides Landed, Landed off-runway or Crashed, with the gentle-Touchdown limits in `tuning.ts`. Lifting off again after a gentle Touchdown forgets it, so touch-and-goes work.
- `src/adapters/keyboard/keyboard.ts` maps keys to actions (by `KeyboardEvent.code`, so the layout doesn't matter); any key also counts as start. It guesses a phone or tablet from the `(hover: none) and (pointer: coarse)` media query.
- `src/world/` is the World as data: ground height, surface type (runway, grass, hill, lake) and distance from the Runway centreline at any point of a 20×20 km area, from the hand-made layout in `world-layout.ts`. No three.js here, so it is unit-tested directly.
- `src/adapters/view/` is the three.js view (decision 0001). `world-scene.ts` builds meshes from the same World data; `view-renderer.ts` renders from the cockpit camera pose, placed every frame, into a hidden 120×32 target, one pixel per character cell of the Cockpit view, and reads it back as a brightness grid (0 to 1 per cell).
- `src/screen/` holds the Screen's size (120 columns × 45 rows, the top 32 rows being the Cockpit view) and what is drawn on it. `cockpit-screen.ts` turns a brightness grid into characters from the Character ramp ` .:-=+*#%@` (`character-ramp.ts`), draws the window frame and the top of the cowling over it, and puts the Instrument panel (`instrument-panel.ts`) below it. `game-screen.ts` is Draw: the title screen, the Cockpit view, or the Cockpit view with PAUSED or the ending banner (block letters from `block-letters.ts`, then the Touchdown stats in knots, feet and degrees from `cockpit-units.ts`) over it, by phase. `framed-screen.ts` draws the title and message screens.
- `src/adapters/screen/screen-output.ts` writes the 45 lines into one `<pre>`. It refuses anything that isn't 45 lines of 120 printable ASCII characters. The `<pre>` is laid out at its natural size and scaled with a CSS transform to fit the window, so it keeps its shape and never wraps.

The look of the 3D picture (how bright each surface is, the sun, the fog) is tuned in `src/adapters/view/world-scene.ts`; the field of view in `view-renderer.ts`.

`docs/spec.md` describes where this is going: a pure Game core (Advance and Draw), keyboard and audio adapters.

## Folder layout

```
src/
  main.ts            entrypoint: wires config, logger and adapters
  config.ts          reads and validates VITE_* settings
  logger.ts          levelled logger over the browser console
  game/              Game core: game state, phases, Advance
  flight/            flight model: the Plane, forces, controls, wheels, tuning numbers
  world/             the World as data
  screen/            Screen size, Character ramp, and the text drawn on the Screen
  adapters/view/     three.js: renders the World into a brightness grid
  adapters/screen/   writes the Screen into the page
  adapters/keyboard/ turns key presses into controls
tests/               mirrors src/ (Vitest)
tests/smoke/         Playwright smoke tests against the built page
deploy/              update-site.sh and rollback.sh for the Beelink
docs/                spec, tickets, decisions
```

## Debugging

- Logs go to the browser console, prefixed `[ascii-sky]`. Start-up logs the build version and Screen size at `info`, then `3D view ready` once three.js has started WebGL.
- If the browser has no WebGL (or it is turned off), the Screen says "ASCII SKY needs WebGL to draw the World" with the reason, and the console has a `3D view could not start` error. Check `chrome://gpu` or `about:support` for WebGL status.
- Each Flight's end is logged at `info` as `flight ended`, with the ending, the crash cause if any, and the Touchdown stats (sink rate and speed in m/s, bank in degrees, centreline distance in metres).
- Phase changes (title, flying, paused, ended), lift-off and touchdown (with speed, sink rate, pitch and position) are logged at `debug`. Use them when tuning `src/flight/tuning.ts`.
- If the game runs slowly (a frame longer than 0.25 s, e.g. software WebGL in a headless browser), each frame only counts 0.25 s, so the game runs in slow motion rather than jumping.
- Add `?debug=1` to the page URL for debug-level logs without a rebuild, or set `VITE_DEBUG=true` and rebuild.
- If start-up fails (a bad setting in a dev build, say), the Screen shows "ASCII SKY could not start." with the reason, and the console has the error.
- A blank page with no log usually means the JS bundle didn't load: check the network tab for a 404 and that `VITE_BASE_PATH` matches where the page is served.

## Deploy

The game is a static site, served at `https://rickphobia.com/ai-projects/ascii-sky/` by nginx in Docker on the Beelink, with `~/homelab/html` as the site root. GitHub can't reach the home network, so the server pulls: you run one script there.

`deploy/update-site.sh` fetches `main` into `~/homelab/dev/ai_projects`, builds in a pinned `node` Docker image (no Node install needed on the server), copies the result to `~/homelab/html/ai-projects/ascii-sky.new`, then renames it into place. The old build stays as `ascii-sky.previous`. If any step fails, the script exits non-zero, names the step, and the live site stays as it was. If `main` hasn't moved since the last deploy, it does nothing.

### First-time setup (on the Beelink)

Needs `git`, `docker` (your user can run it without sudo) and `flock` (part of `util-linux`, already on Ubuntu). The clone is shared with the other projects, so skip it if `~/homelab/dev/ai_projects` exists.

```bash
mkdir -p ~/homelab/dev && git clone https://github.com/rickphobia/ai_projects.git ~/homelab/dev/ai_projects
~/homelab/dev/ai_projects/projects/ascii-sky/deploy/update-site.sh
```

No nginx change is needed: `/ai-projects/` is already served from `~/homelab/html/ai-projects/` (see pawn-swarm's README).

### Update

```bash
~/homelab/dev/ai_projects/projects/ascii-sky/deploy/update-site.sh
```

To rebuild even though `main` hasn't changed: `ASCII_SKY_FORCE=1 ~/homelab/dev/ai_projects/projects/ascii-sky/deploy/update-site.sh`.

Settings (all optional, shown with defaults in `.env.example`) are environment variables: `ASCII_SKY_REPO_URL`, `ASCII_SKY_BRANCH`, `ASCII_SKY_SRC_DIR`, `ASCII_SKY_SITE_ROOT`, `ASCII_SKY_SITE_SUBPATH`, `ASCII_SKY_NODE_IMAGE`, `ASCII_SKY_FORCE`. The scripts do not read `.env`.

### Roll back

```bash
~/homelab/dev/ai_projects/projects/ascii-sky/deploy/rollback.sh
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
