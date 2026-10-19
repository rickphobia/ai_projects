# Against All TOD

A solo Tower Offense Defense browser game: build a Maze, then switch sides and try to break it, on a Board that never resets. A demo for testing whether the idea is fun before it becomes a Steam game. It will be played at `https://rickphobia.com/ai-projects/against-all-tod/` and on itch.io.

## Status

`in progress`: a full solo Run. The page draws the 20×14 Board with the Spawn line on the left column and the Goal on the right edge. Round 1 is a Defense turn: pick Crate Wall or Sniper Nest from the shop (each button shows its price) and click or tap tiles to buy and place them with Defense gold, then press Fight to watch a game-made Army of 40 Interns walk the route. Every won Round switches sides: on an Attack turn you buy Squads of Interns with Attack gold and add them to the Spawn line and the whole Army attacks the Maze you built. You have 3 Lives; a lost Round costs one and Rewinds the Board, Army and both wallets to the start of that Round, plus bonus gold for the side you played. Defense gold comes from kills and the Goal health left after a won Defense turn; Attack gold from Dudes reaching the Goal and Dudes still alive when it breaks. A won Round keeps what the battle earned. The HUD shows the Round, side, Lives, Score (Rounds won) and both wallets; at zero Lives the end screen shows the Score against the session's best Score and starts a new Run in one click. Click, tap or hover a Piece to see what it does; scroll or pinch to zoom, drag to pan; a phone held upright asks to be turned to landscape. A placement that would seal the Goal off is refused with a message. Watch at 1x, 2x or 4x. The Run and best Score are saved in the browser after every action, so a refresh or closed tab picks up where you were (a reload mid-battle restarts that battle; a save that can't be read gives a fresh start with a short message). Each Round opens a Draft Crate for the side being played along the bottom of the Board: 3 random items from that side's pool (Pieces on defense; Squads and Mutations on attack), one taken for free, or the whole crate rerolled for that side's gold. Defense crates also offer the Turnstile (a wall with two arms that turns 90° every 5 seconds, flipping the route), the Lighthouse (a sweeping beam that hurts Dudes) the Siren (stuns Dudes near it every few seconds), the Tax Booth (a floor Piece: each Dude walking over it moves Attack gold to Defense gold), the Grinder (a floor Piece that kills Interns, Termites and Streakers outright for double gold, hurts bigger Dudes, and jams for 3 seconds after each kill), the Bouncer (throws the first Dude it touches back to the Spawn line, then waits 6 seconds) and the Decoy Goal (walkers go for it first; each hits it and vanishes without earning gold, until it breaks for that battle); the shop sells only Crate Walls and Sniper Nests so far. Attack crates also offer Wall-breakers, the only Dudes that damage Pieces: Termites chew slowly through the wall in their way, a Ram Crew smashes a wall or tower in one hit and slows as its 4 carriers fall, and a Sapper runs to the nearest wall and blows up himself and the wall. Wall-breakers head for the wall that matters (through it, when the way round is long); a destroyed Piece is gone, the other Dudes re-route through the hole, each one pays Attack gold, and it stays gone if the Round is won (a Rewind puts it back). A taken Piece or Squad is placed for free next; a taken Mutation changes every Dude in the Army for the rest of the Run, and Mutations stack: Split (a dying Dude becomes two halves), Giant (one Dude per Squad has 5× health at half speed, drawn bigger), Explosive Shields (every Dude has a small shield that stuns towers within 3 tiles for 1 second when it breaks), Conga Line (a Squad walks single file and shares every hit across its living members), Ghost Mode (a dead Dude walks on for 3 seconds, faded out, where nothing can touch it, and still damages the Goal and pays if it gets there) and Gold Teeth (double Attack gold for reaching the Goal). A Rewind opens the same crate again. More content comes in the next tickets (`docs/tickets/`). `docs/spec.md` describes the whole demo.

![An Attack turn: Squads on the Spawn line, the route through the Maze built last Round](docs/screenshots/06-attack-turn.png)

## Requirements

- Node.js 22.22.0 (the version in `.nvmrc`; `nvm use` picks it up) and npm
- A browser with JavaScript; WebGL is used when available (PixiJS falls back to WebGPU or a plain canvas)
- `zip`, only for making the itch.io upload

No accounts or API keys.

## Setup

```bash
cd projects/against-all-tod
npm ci
cp .env.example .env   # the example values work as they are
```

## Run

```bash
npm run dev       # dev server with reload, at the URL it prints
npm run build     # static build in dist/
npm run preview   # serve dist/ to check the build
npm run itch-zip  # build and zip for itch.io: itch/against-all-tod-<commit>.zip
```

## Test

```bash
npm run check     # lint, format check, type check and unit tests: what CI runs
npm run test      # unit tests only
npm run format    # fix formatting
npm run bench     # times the 500-Intern swarm battle headless, in ms per step
```

The performance target (`docs/spec.md`) is 500 Dudes at 60 fps on a mid-range laptop and at least 30 fps on a mid-range phone. To measure it, run `npm run dev` (or open any build) with `?debug=1&scene=swarm` added to the URL: the swarm debug scene sends 500 Interns at a sample Maze of walls and Sniper Nests at 1x, starts over when the battle ends, and the corner shows the frame rate, the lowest it has been and how many Dudes are on the Board. `npm run bench` checks the battle rules alone, without drawing.

Developer URL options:

- `?seed=<n>` starts a Run with seed `n` (0 to 4294967295); the same seed and the same actions give the same Run. A reload keeps the saved Run while its seed matches.
- `?debug=1` logs at debug level and shows buttons to give 100 gold to either wallet, jump to Round N with the Board as it is, and toggle the route preview.
- To wipe the save, run `localStorage.removeItem("against-all-tod.save")` in the browser console.

CI (`.github/workflows/against-all-tod.yml`) runs `npm run check`, the build and `shellcheck` on the deploy and zip scripts on every push that touches this project.

## Configuration

Read from `.env` at build time (Vite bakes `VITE_*` variables into the page) and validated in `src/config.ts`. `vite.config.ts` validates them too, so a bad value fails the build instead of shipping a blank page.

| Variable | Required | What it does |
|----------|----------|--------------|
| `VITE_BASE_PATH` | yes | Where the site is served from. `./` (the default) works from any folder, so the live site, PR previews and itch.io use the same build. An absolute path must start and end with `/`. |
| `VITE_DEBUG` | yes | `true` logs at debug level in the browser console; `false` logs info and above. |
| `VITE_DEFAULT_SEED` | yes | Seed for the first Run when the URL gives none, a whole number from 0 to 4294967295. Each new Run from the end screen uses the next seed. |
| `VITE_BUILD_VERSION` | no | Names the build in the start-up log. `deploy/update-site.sh` and `npm run itch-zip` set it to the commit, `scripts/try-pr.sh` to the PR and commit; otherwise `dev`. |

The deploy scripts read their own `AGAINST_ALL_TOD_*` variables from the shell; see "Deploy".

## How it works

The spec (`docs/spec.md`, "Modules") plans pure rule modules (maze, battle, run, economy and so on) with no DOM or PixiJS, and adapters around them. The skeleton has the first pieces:

- `src/main.ts` is the entrypoint: it loads the config, makes the logger, starts the renderer and the HUD, and the end screen, and hands them to `src/run-screen.ts`. If anything throws, it logs the error and shows the start-up error screen.
- `src/adapters/storage/save-store.ts` saves the Run as JSON in `localStorage` with a version number after every accepted Run action (including Fight, so the ready-to-fight state is saved) and loads it at start-up. Data that isn't JSON, has another version or doesn't fit the rules gives a fresh start and a logged warning; the save itself is never logged. Bump `SAVE_VERSION` when the saved shape changes.
- `src/debug/debug-options.ts` reads `?seed=` and `?debug=1` and holds the debug changes to a Run (give gold, jump to Round N); `debug-panel.ts` draws their buttons.
- `src/run-screen.ts` wires a Run to the screen: Board taps and HUD buttons become Run actions (a refusal is logged and shown), Fight starts the Round's battle, each frame runs the steps the watch clock says are due and hands the state to the renderer, and the winner goes back to the Run.
- `src/run/run.ts` is the Run, a pure state machine: `applyRunAction` takes the state and an action (take from crate, reroll crate, place Piece, place Squad, start battle, battle finished, continue, new Run) and returns the new state or a typed refusal (`wrong-phase`, `wrong-side`, `not-enough-gold`, `not-spawn-line`, `no-crate`, or the Maze's own). Round N is Rounds won + 1; odd Rounds are Defense turns, even Rounds Attack turns. Placing a Piece pays from the Defense wallet and a Squad from the Attack wallet, never the other. A won Round keeps everything placed plus the gold the battle earned (the `battle-finished` action carries it); a lost one costs a Life and puts back the Board, Army and wallets saved at the start of the Round, plus the Rewind bonus for the side played.
- `src/run/crate.ts` rolls a Round's Draft Crate from the Round's seed and the reroll count (so a Rewind, which puts rerolls back to zero, offers the same crate), leaving out Mutations the Army has. `src/catalog/pools.ts` holds what each side's crates can offer, the crate size and the reroll price; `src/catalog/mutations.ts` the Mutations. The Run keeps the crate, the taken Piece or Squad waiting to be placed for free, and the Army's Mutations (in the Rewind snapshot too); `src/ui/crate.ts` draws the crate.
- `src/economy/economy.ts` turns a battle's events and end (winner, Goal health, surviving Dudes) into gold for each wallet: per kill, Goal health bonus, per Dude reaching the Goal, per survivor when the Goal breaks and per Piece a Wall-breaker destroys, each times the Dude kind's `goldValue`, with Gold Teeth doubling the gold for reaching the Goal. `spend` takes gold from one side only. The state is plain data (Pieces as a list, not a Maze) so ticket 08 can save it as it is; `mazeOf` rebuilds the Maze and `battleSetupOf` the Round's battle, with a seed per Round from the Run's seed.
- `src/battle/` is the battle, pure and headless. `battle.ts` starts a battle from a Maze, an Army, a seed and the battle rules, and steps it at a fixed 1/60 s: Dudes file onto the Board, towers fire, Lighthouse beams and Siren pulses hit, Dudes walk (unless stunned) along the route of the moment (the Turnstiles' turned route every other 5 seconds) or, for a Wall-breaker with a Piece in its way, hit that Piece, then it checks the end (Goal at zero: attack wins; no Dudes left or 90 s of game time: defense wins). `dudes.ts` walks a Dude along the shared route, `area-effects.ts` sweeps the Lighthouse beams, pulses the Sirens (range scaled by the Volume level, neutral until the Volume trick arrives), skipping Dudes underground and flyers unless the beam or stun hits air, and lists the tiles Lighthouses light, `towers.ts` fires the Sniper Nests (biggest Dude in range, then the one closest to the Goal; each step sorts the Dudes by tile, so a tower only looks at the tiles its range reaches), `traps.ts` runs the Tax Booth and Grinder for Dudes stepping onto them, the Bouncer, and the fields walkers follow to a Decoy Goal first, `wall-breakers.ts` picks a Wall-breaker's field (the maze module's `wallBreakerRoutes`: to the Goal with blocking Pieces passable at a high cost, or to the nearest wall for the Sapper), finds the Piece in its way and applies its hit; the battle state keeps its own Maze and Piece health, and a destroyed Piece leaves the Maze (`removePiece`, which works the routes out again), the towers and the effect Pieces. `damage.ts` is where every hit lands (shots, beams and Grinders alike), so the Mutations that change damage work the same for all of them: a small shield soaks first and a Conga Line Squad shares the hit. `mutations.ts` does the rest of the Mutations: it makes the Army's Dudes (giants, small shields, single file), turns the step's dead into Split halves or Ghost Mode ghosts (kept in their own list, so no tower, beam or trap sees them), walks the ghosts and stuns towers near a burst shield; their numbers are in `src/catalog/mutations.ts`, and Gold Teeth is the economy's. `events.ts` lists what a step emits (shot, kill, reach Goal, Piece destroyed, taxed, Decoy Goal hit, shield burst) for gold and reports, and `watch-clock.ts` turns real frame time into steps at 1x, 2x or 4x. Watch speed only changes how many steps run per real second, so the result is the same at every speed.
- `src/rng/rng.ts` is the seeded random number source (Mulberry32). The battle uses it to spread each Squad's Dudes across their tile.
- `src/maze/board.ts` is the Board's layout as data: 20 columns × 14 rows, the Spawn line on column 0, and the Goal on the right column in the middle two rows (6 and 7). Pure, so the maze and battle rules can share it.
- `src/maze/maze.ts` holds the placed Pieces and answers "may this Piece go here?" with a typed refusal (`off-board`, `spawn-line`, `goal`, `tile-taken`, `seals-goal`). A Maze is immutable and carries its route, recomputed on each placement, plus the route while every Turnstile stands turned (all turn together, so there are only two); a placement must keep the Goal reachable on both.
- `src/maze/route.ts` is the route: one breadth-first direction field from the Goal over walkable tiles, so every Dude on a tile shares one step. Equally short steps are broken toward the Goal's centre, so routes cut diagonally toward the Goal rather than run along an edge.
- `src/catalog/` holds every tuning number: `pieces.ts` for Pieces (price, health, whether it blocks Dudes, range, damage and fire rate for towers, beam and stun numbers, the Turnstile's turn time, and whether each tower, beam or stun hits flying Dudes), `dudes.ts` for Dude kinds (health, speed, Goal damage, size, Squad size, Squad price, gold value) and the Round 1 Army, `battle-rules.ts` for the Goal's health and the time limit, `gold-rules.ts` for starting gold, each gold rule and the Rewind bonus, and `run-rules.ts` for the starting Lives. Tests read numbers from it.
- `src/adapters/renderer/` draws with PixiJS. `game-renderer.ts` starts PixiJS in the page and keeps the Board scaled to fit the window (`fit-to-view.ts`); `board-view.ts` builds the Board from Kenney tiles, with faint lines between tiles, a stripe in the attack colour on the Spawn line and the Goal framed in the defense colour. `board-textures.ts` loads the tiles. `pieces-view.ts` draws the Pieces (a Sniper Nest's turret turns toward its last shot, a Lighthouse's lamp follows its beam, a Turnstile's arms turn with it), `route-view.ts` the route preview, `squads-view.ts` the Army's Squads on the Spawn line (a Dude on a disc in the attack colour with the Squad's size) and `placement-cursor.ts` the tile under the mouse (a ghost Piece or Squad, or a red frame where it can't go). `units-view.ts` draws a battle: each Dude on a disc tinted by kind (Interns in the attack colour; Balloonists drawn bigger, a Mole faded while underground, a Shield Bro's disc dimmed once his shield breaks), and shot tracers in the defense colour. Each Dude is two sprites sharing two textures (the disc is drawn once into a texture at start-up), so PixiJS batches the whole swarm, and a frame only moves sprites. `goal-health-view.ts` is the Goal's health bar. `camera.ts` is the zoom and pan: pure maths for screen-to-Board conversion and clamping, so the Board can't be zoomed out past fitting the window, in further than 2.5×, or dragged off screen.
- `src/adapters/input/board-pointer.ts` turns mouse, wheel and touch events on the canvas into hovers, taps, pans and pinch zooms. A press that moves more than a few pixels, or gains a second finger, pans or zooms and never places.
- `src/ui/hud.ts` is the band above the Board: the Round, side, Lives, Score and both wallets, the shop's Piece or Squad buttons with their prices (`shop.ts` lists them) and Fight, the watch speed buttons, the Goal's health and the battle clock, the winner with Continue, and why an action was refused.
- `src/ui/end-screen.ts` is the end-of-Run screen: the Score, the best Score and a New Run button.
- `src/ui/report.ts` is the Round report shown after every battle: Goal damage, kills per Piece kind, a heat map of where Dudes died and where each wallet's gold came from (`goldBreakdown` in `src/economy/economy.ts`). One click or tap anywhere closes it.
- `src/ui/piece-info.ts` is the panel naming the Piece under the mouse or last tapped, with its one-line description.
- `src/ui/device.ts` shows the turn-your-device screen while a touch device is held upright.
- `src/ui/startup-error-screen.ts` shows why the game could not start, in plain DOM.
- `src/ui/fps-meter.ts` is the swarm scene's frame-rate reading.
- `src/debug/swarm-scene.ts` is the swarm debug scene's Maze, Army and rules (a Goal that outlasts every Intern), and the URL check that picks it; `swarm-screen.ts` plays it outside the Run. `scripts/swarm-bench.ts` runs the same battle headless for `npm run bench`.

## Folder layout

```
src/
  main.ts              entrypoint: wires config, logger, renderer and HUD
  run-screen.ts        a Run on screen: taps and buttons to Run actions, battles stepped each frame
  config.ts            reads and validates VITE_* settings
  logger.ts            levelled logger over the browser console
  catalog/             tuning numbers for every Piece, Dude kind, the battle and the Run
  run/                 the Run: Rounds, sides, Lives, Rewind, Score
  maze/                the Board's layout, Piece placement and the route
  battle/              the fixed-step battle, its events and the watch clock
  rng/                 seeded random numbers
  adapters/input/      mouse, wheel and touch to taps, pans and zooms
  adapters/renderer/   PixiJS: draws the Board, Pieces, route and battle, fits it to the window
  ui/                  DOM: the HUD, end screen, piece info, turn-your-device and start-up error screens, fps meter
  debug/               debug scenes picked from the URL (the 500-Intern swarm)
assets/                Kenney art, with its licence
tests/                 mirrors src/ (Vitest)
scripts/itch-zip.sh    builds and zips the game for itch.io
scripts/swarm-bench.ts times the swarm battle headless (npm run bench)
deploy/                update-site.sh and rollback.sh for the Beelink
docs/                  spec, tickets, decisions, screenshots
```

## Debugging

- Logs go to the browser console, prefixed `[against-all-tod]`. Start-up logs the build version and Board size at `info`, then `renderer ready` (with `webgl`, `webgpu` or `canvas`) and `Board drawn`. Each Round logs `Round started` (Round, side, Lives, Score) at `info`. A refused action logs `action refused` at `info` with the action and the reason; each placed Piece or Squad logs `placed` at `debug`. Fight logs `battle started` (Round, side, seed, Piece and Squad counts) and the end logs `Round finished` (won or not, winner, reason, step, Goal health left, kills, Dudes that reached the Goal, gold earned, both wallets, Lives and Score) at `info`; the last Life logs `Run over` with the Run's seed and Score. To replay a Round headless, rebuild the Run in a test with the same actions and call `runBattle(battleSetupOf(state))`.
- Add `?debug=1` to the page URL for debug-level logs without a rebuild (it also logs the config), or set `VITE_DEBUG=true` and rebuild.
- Add `?debug=1&scene=swarm` for the swarm debug scene and its fps reading (see "Test"). It logs `swarm scene` at `info`.
- A `WebGL is off or unavailable` warning means the browser fell back to a plain canvas: the game still draws but will be slower once there are hundreds of Dudes. Check `chrome://gpu` or `about:support`.
- If start-up fails, the page shows "Against All TOD could not start" with the reason, and the console has a `start-up failed` error with its `kind` (`ConfigError`, `RendererStartError` or another).
- A blank page with no log usually means the JS bundle didn't load: check the network tab for a 404 and that `VITE_BASE_PATH` matches where the page is served.

## Deploy

The game is a static site, served at `https://rickphobia.com/ai-projects/against-all-tod/` by nginx in Docker on the Beelink, with `~/homelab/html` as the site root. GitHub can't reach the home network, so the server pulls: you run one script there.

`deploy/update-site.sh` fetches `main` into `~/homelab/dev/ai_projects`, builds in a pinned `node` Docker image (no Node install needed on the server), copies the result to `~/homelab/html/ai-projects/against-all-tod.new`, then renames it into place. The old build stays as `against-all-tod.previous`. If any step fails, the script exits non-zero, names the step, and the live site stays as it was. If `main` hasn't moved since the last deploy, it does nothing.

### First-time setup (on the Beelink)

Needs `git`, `docker` (your user can run it without sudo) and `flock` (part of `util-linux`, already on Ubuntu). The clone is shared with the other projects, so skip it if `~/homelab/dev/ai_projects` exists.

```bash
mkdir -p ~/homelab/dev && git clone https://github.com/rickphobia/ai_projects.git ~/homelab/dev/ai_projects
~/homelab/dev/ai_projects/projects/against-all-tod/deploy/update-site.sh
```

No nginx change is needed: `/ai-projects/` is already served from `~/homelab/html/ai-projects/` (see pawn-swarm's README).

### Update

```bash
~/homelab/dev/ai_projects/projects/against-all-tod/deploy/update-site.sh
```

To rebuild even though `main` hasn't changed: `AGAINST_ALL_TOD_FORCE=1 ~/homelab/dev/ai_projects/projects/against-all-tod/deploy/update-site.sh`.

Settings (all optional, shown with defaults in `.env.example`) are environment variables: `AGAINST_ALL_TOD_REPO_URL`, `AGAINST_ALL_TOD_BRANCH`, `AGAINST_ALL_TOD_SRC_DIR`, `AGAINST_ALL_TOD_SITE_ROOT`, `AGAINST_ALL_TOD_SITE_SUBPATH`, `AGAINST_ALL_TOD_NODE_IMAGE`, `AGAINST_ALL_TOD_FORCE`. The scripts do not read `.env`.

### Roll back

```bash
~/homelab/dev/ai_projects/projects/against-all-tod/deploy/rollback.sh
```

Swaps `against-all-tod` and `against-all-tod.previous`. Run it again to undo. The next `update-site.sh` run puts the latest `main` back.

### Check that it worked

```bash
curl -I https://rickphobia.com/ai-projects/against-all-tod/   # expect HTTP 200
cat ~/homelab/dev/against-all-tod.deployed-commit            # the commit that is live
```

Then open the URL: the console's `starting` line shows the same commit.

### itch.io

`npm run itch-zip` builds with relative paths and writes `itch/against-all-tod-<commit>.zip` with `index.html` at its root. On the itch.io project page, set "Kind of project" to HTML, upload the zip and tick "This file will be played in the browser". The `itch/` folder is not committed.

### PR previews

`scripts/try-pr.sh <PR number>` builds a PR on the Beelink and serves it; the preview timer does this for every open PR (see "Previews on the Beelink" in `docs/workflow.md`).

## Credits

Art from [Kenney](https://kenney.nl), CC0 (public domain); the licence ships in `assets/`:

- [Tower Defense (top-down)](https://kenney.nl/assets/tower-defense-top-down): grass, dirt, stone base, crate, tower base, turret and soldier tiles (`assets/kenney-tower-defense-top-down/`)

## Decisions

See `docs/decisions/` for why things are the way they are.
