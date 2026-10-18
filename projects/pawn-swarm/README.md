# Pawn Swarm

A browser auto-battler on a chess board: your white pawns are your army and your money. Mix of Brotato, How Many Dudes and chess.

## Status

`working` — the demo is complete. The battle is the real-time swarm from the prototype (`docs/prototype/`, decision 0002): one pawn in the middle of a 16×11 board against all 10 waves of knights, bishops, rooks, queens and finally the king, each wave landing in 3 pushes. Kills drop pawns that snowball the swarm; killing the king wins. Pause and 0.5×–2× speed. Between waves, the shop sells the common pawn types (Shield, Spear, Twin) for plain pawns, from wave 3 the rare ones (Medic, Banner, Bomb) and from wave 6 the epic ones (Recruiter, Berserker, Promoter, En passant). During a battle, each pawn type on the board gives a skill button (Charge, Hold the line, Volley, Fork, Triage, Rally, Detonate, Call to arms, Frenzy, Rush, Sidestep) with a cooldown; keys 1–9 fire them and Space pauses. The shop also shows an army stats panel (per-type count, HP, attack, damage per second; army totals; last wave's results). The battle has sound (effects and a music loop that gets more intense when the king lands), pieces that lunge, recoil, slam down and collapse, blood, gibs and screen shake, and a Settings button for volume, mute and shake. From wave 3, black pieces can turn up as special types with a power, marked by a coloured ring under them (Stomper, Priest, Hunter, Tower, Sniper, Cannon, Storm, Summoner); the shop shows the ones new in the next wave and, in a collapsible list, the ones that could already have turned up. Kills sometimes drop a coloured orb (Heal, Haste, Fury, Freeze, Bounty, Reinforcements) that drifts to the nearest pawn and works for the whole swarm when touched; a toast names it.

## Requirements

- Node.js 22.12 or newer (`.nvmrc` pins the version CI uses; `nvm use` picks it up)
- A modern browser
- No accounts or API keys

## Setup

```bash
cd projects/pawn-swarm
npm ci
cp .env.example .env   # the example values work as they are
```

## Run

```bash
npm run dev       # dev server at http://localhost:5173
npm run build     # static build in dist/ (relative paths: works from any folder or preview link)
npm run preview   # serve dist/ locally
```

## Test

```bash
npm run check          # what CI runs: lint, format check, type check, tests
npm run lint           # ESLint
npm run format:check   # Prettier (npm run format to fix)
npm run typecheck      # tsc, strict
npm test               # Vitest, once
npx vitest             # Vitest, watch mode
```

CI runs `npm run check`, `npm run build` and `shellcheck deploy/*.sh` on every push that touches this folder (`.github/workflows/pawn-swarm.yml`).

## Deploy

The game is a static site. It is served at `https://rickphobia.com/ai-projects/pawn-swarm/` by nginx in Docker on the Beelink, with `~/homelab/html` as the site root. GitHub can't reach the home network, so the server pulls: you run one script there, or a timer runs it.

`deploy/update-site.sh` fetches `main` into `~/homelab/dev/ai_projects`, builds in a pinned `node` Docker image (no Node install needed on the server), copies the result to `~/homelab/html/ai-projects/pawn-swarm.new`, then renames it into place. The old build stays as `pawn-swarm.previous`. If any step fails, the script exits non-zero, names the step, and the live site stays as it was. If `main` hasn't moved since the last deploy, it does nothing.

### First-time setup (on the Beelink)

Needs `git`, `docker` (your user can run it without sudo) and `flock` (part of `util-linux`, already on Ubuntu).

```bash
mkdir -p ~/homelab/dev && git clone https://github.com/rickphobia/ai_projects.git ~/homelab/dev/ai_projects
~/homelab/dev/ai_projects/projects/pawn-swarm/deploy/update-site.sh
```

**nginx check.** No nginx change is needed if `/ai-projects/` is already served from `~/homelab/html/ai-projects/`. After the first run, `curl -I https://rickphobia.com/ai-projects/pawn-swarm/` should say `200`. If it says `404`, nginx is mapping that path somewhere else; fix its `root`/`location` for `/ai-projects/` and reload nginx. Checked 2026-10-03: the page returns `200` and its JS and CSS bundles load, with no nginx change. Cloudflare sits in front of nginx (responses carry `server: cloudflare`).

### Update

```bash
~/homelab/dev/ai_projects/projects/pawn-swarm/deploy/update-site.sh
```

To rebuild even though `main` hasn't changed: `PAWN_SWARM_FORCE=1 ~/homelab/dev/ai_projects/projects/pawn-swarm/deploy/update-site.sh`.

Settings (all optional, shown with defaults in `.env.example`) are environment variables: `PAWN_SWARM_REPO_URL`, `PAWN_SWARM_BRANCH`, `PAWN_SWARM_SRC_DIR`, `PAWN_SWARM_SITE_ROOT`, `PAWN_SWARM_SITE_SUBPATH`, `PAWN_SWARM_NODE_IMAGE`, `PAWN_SWARM_FORCE`. The scripts do not read `.env`.

### Update every 15 minutes (optional)

systemd user units, so no root is needed. `loginctl enable-linger` keeps them running when you're logged out.

```bash
mkdir -p ~/.config/systemd/user
cp ~/homelab/dev/ai_projects/projects/pawn-swarm/deploy/pawn-swarm-update.{service,timer} ~/.config/systemd/user/
loginctl enable-linger "$USER"
systemctl --user daemon-reload
systemctl --user enable --now pawn-swarm-update.timer
```

Check it with `systemctl --user list-timers pawn-swarm-update.timer` and `journalctl --user -u pawn-swarm-update.service -e`. The service has the default source path in it; if you changed `PAWN_SWARM_SRC_DIR`, edit the copy in `~/.config/systemd/user/`.

### Roll back

```bash
~/homelab/dev/ai_projects/projects/pawn-swarm/deploy/rollback.sh
```

Swaps `pawn-swarm` and `pawn-swarm.previous`. Run it again to undo. If the timer is on, stop it first (`systemctl --user stop pawn-swarm-update.timer`), or it puts the latest `main` back at its next run. Fix `main`, then start the timer again.

### Check that it worked

```bash
curl -I https://rickphobia.com/ai-projects/pawn-swarm/   # expect HTTP 200
cat ~/homelab/dev/pawn-swarm.deployed-commit  # the commit that is live
```

Then open the URL and start a run. Scripts are checked with `shellcheck deploy/*.sh` (CI runs it too).

## Balance check

```bash
npm run balance                        # 20 headless runs from seed 1
npm run balance -- --runs 100 --seed 7 # 100 runs from seed 7
```

Plays whole runs without a browser using a simple bot and prints each run's result, the win rate, how many runs ended in each wave, and the biggest swarm. Use it to see what a change to `catalog/` does to the game. It is not a CI gate. In the shop the bot recruits greedily: from the first offer it can afford, until it can't. In battle it fires every skill the moment it is ready. Over 100 runs from seed 1 it wins none and mostly dies in waves 4–7 (average wave 5.6) with at most ~100 pawns. Recruiting is still a poor trade: a bot that never recruits, and so only has Charge, averages wave 8.1, because Charge on a big plain swarm beats a few typed pawns that cost 3+ plain pawns each.

## Configuration

Vite reads these from `.env` and bakes them into the build. The game checks them on page load and shows an error on the page if one is missing or invalid.

| Variable | Required | What it does |
|----------|----------|--------------|
| `VITE_DEFAULT_SEED` | yes | Seed for a new run when none is given (0–4294967295). |

## How it works

`src/main.ts` loads the config, starts a run and drives it: every animation frame it asks the clock how many steps are due, advances the run that many steps, feeds each step's battle events to the effects, updates the HUD and redraws the board.

During a battle, keys 1–9 fire the skill buttons in order and Space toggles pause. A skill pressed while paused waits and fires on the next step.

The battle runs at a fixed 60 steps per game second. The game plays at a pace of 0.65 game seconds per real second, so at 1× a step is due every 1/39 s. `tick-clock.ts` turns real time into steps: at 2× twice as often, while paused never. Pace and speed only change *when* steps run, never what a step does, so a seed plays out the same at every speed (tested in `tests/tick-clock.test.ts`).

The rules are pure functions with no DOM, so tests drive them directly:

- `run/` — the run state machine (`battle → shop → battle | won | lost`). `advanceRun` plays one step and keeps the biggest swarm and the pieces taken, plus a `waveReport` for the wave being fought (`wave-report.ts`: pieces taken, pawns gained from drops, pawns lost, biggest swarm, game seconds; a new wave starts a fresh one, and the shop shows the wave just cleared); the call after a cleared wave opens the shop, with the survivors as the army. `actInShop` applies the player's shop actions; "start wave" starts the next wave with the army at full HP, each pawn keeping its type, and carries locked offers to the next shop. Killing the king, or clearing the last wave, wins.
- `shop/` — `shop.ts`: offers (3 slots, never the same type twice, weighted by rarity and gated by wave), recruit (price `ceil(base / 2 × (1 + 0.25 × (wave − 1)))` plain pawns on top of the one that turns, at most 5 of a type per shop visit), reroll (`1 + rerolls this visit + floor(wave / 3)`), lock, and the rule that the shop never takes the last plain pawn. `shop-view.ts` works out everything the shop screen shows, including the stats panel (damage per second is attack ÷ seconds between strikes).
- `skills/` — skill cooldowns, whether a skill can be used now (`skillBlocker`: no pawns of the type, or on cooldown), the button order (one per type on the board, in catalog order), and what the skill bar shows. Cooldowns count in game seconds; the bar shows real seconds at 1×.
- `battle/` — `step(state, inputs)` plays one step. `inputs.skillUses` lists the skills fired on it; a seed plus every use (`{ step, skill }`, replayed with `skillsUsedAt`) replays a battle exactly. A use the rules refuse does nothing.
  0. `skill-effects.ts` fires the skills used this step, for every pawn of the type: Charge (plain pawns twice as fast, +1 attack for 3 s), Hold the line (shields take no damage and draw black pieces from 6.9 squares for 4 s), Volley (each spear hits black pieces within 4 squares in its row and column for 3), Fork (each twin hits black pieces within 1.375 squares for 2), Triage (heals every pawn to full), Rally (every pawn, not just banners, walks and strikes 60% faster for 5 s) and Detonate (every bomb blows up). The numbers live with each skill in `catalog/pieces.ts`.
  1. `black-pieces.ts` lands the pieces whose warning ran out, with the wave's HP (35% more of the wave-1 HP per wave, tripled for a Tower). The type of each piece is rolled when its landing is planned (`black-type-rules.ts`: each unlocked type of the piece's kind rolls in catalog order, 18% the wave it unlocks, +7% per wave, at most 45%; nothing is rolled before wave 3).
  1½. `passives.ts` pulses each medic (heals other pawns within 2.5 squares by 1 HP every 1.5 s) and works out a banner's +1 attack for pawns within 2.5 squares of it.
  2. `white-pawns.ts` skips stunned pawns (a bomb's blast stuns them for 2 s: `explosions.ts`, called when a bomb pawn dies or Detonate fires; it hurts black pieces within 2 squares for 4 and never hurts white pawns). A medic has 0 attack, so it walks to the nearest fighting pawn instead of fighting. Every other pawn moves toward the nearest black piece (where it is now, even mid-move: `piece-position.ts`), one axis at a time, and strikes when in reach and off cooldown (a twin strikes the next piece in reach too). `strike.ts` deals each blow (strikes and skill hits); a kill calls `drops.ts`, which spawns plain pawns on the square (fewer as the swarm grows: crowding).
  3. Pawns push apart and stay on the board.
  4. A Freeze power-up skips this whole phase. Otherwise each black piece hurts the pawns touching it; the king (and a Summoner queen) calls knights next to itself on a timer; a special type uses its power (`black-powers.ts`: a Priest heals, a Cannon and a Storm hit pawns in an area from `area-hits.ts`); the king calls 3 knights next to him every 6 s (`landing-squares.ts` picks free squares, with a 0.8 s warning). Then `black-moves.ts` carries on with its move: pick the legal move closest to its target (a shield within 3.4 squares, else the nearest pawn), warn on its hit squares for 0.4 s, move, and hit every pawn on them (`pawn-hits.ts`).
  4½. `orbs.ts` ages the power-up orbs, drifts each toward the nearest pawn within 3 squares and triggers it on touch (a new orb waits 0.4 s first, because the pawns its kill dropped stand on the same spot). `orb-drops.ts` rolls the orb when a piece dies. Timed power-ups (Haste, Fury, Freeze, Bounty) are timers in the battle state (`power-ups.ts`); Haste and Fury are read by `skill-effects.ts` and Bounty by `drops.ts`, before crowding rounds the drop.
  5. `pushes.ts` lands the wave's next push once the last one is down to 25%, or after 25 s.
  `create-battle.ts` sets up a wave: the army in a spiral around the centre (most HP in the middle), the wave split into 3 pushes (the king in the last), and the first push's landing squares. `landing-squares.ts` puts each piece on a free square, half in a ring around the swarm, never within 3 squares of a pawn while there is room. `spatial-grid.ts` answers "which pawns are near this point" without checking every pawn.
- `board/` — squares, positions in board units (1 square = 1), and each piece's chess moves with the squares they hit: sliders (bishop, rook, queen) hit their whole path and can't pass through other black pieces; the knight and king hit the 3×3 block where they land (a Stomper adds the four squares two away in a line).
- `catalog/` — pawn types (stats, passive, skill text, rarity and price), black pieces, black types (`black-types.ts`: piece, first wave, ring colour, power text and numbers), power-ups (`power-ups.ts`), rule numbers, shop numbers and the 10-wave table as data. Rebalance here, then run `npm run balance`.
- `balance/` — plays headless runs with the bot and formats the report for `npm run balance`.
- `rng.ts` — the seeded RNG. Its state lives inside the battle state, so the same seed always plays out the same battle. Rule code never uses `Math.random`.

Each step also lists what happened in it (`skill`, `strike`, `pawn-hurt`, `death`, `drop`, `landed`, `stomp`, `push`, `summon`, `black-power`, `orb-drop`, `power-up`). The rules never read these; they drive the logs and the on-screen effects.

The `adapters/` only draw state and report clicks; they never change rules:

- `art/` — every piece's drawing as SVG code, in the grotesque dark-fantasy style of `docs/art/` (decision 0003): all 11 pawn types, the 5 black pieces and the 8 black types. `animation.ts` lets one drawing play live (SMIL, for portraits) or as still frames (for the canvas). `portraitSvg(id, label)` in `portrait.ts` gives the DOM a live, animated portrait of a piece, e.g. for the shop.
- `canvas-renderer/piece-art.ts` — the one place that maps a piece to its drawing and size. At startup it decodes each drawing's 8 animation frames as one image; per square size it cuts sprite sheets from them, so a battle only copies pixels. Each piece shows the frame for the current time, offset by its id so a crowd doesn't blink in step.
- `canvas-renderer/board-art.ts` — paints the empty board: dark squares, old blood stains, a vignette.
- `canvas-renderer/effects.ts` — turns battle events into damage numbers, blood sprays, gibs, blood pools, "+n ♟" pop-ups, strike lines and rings, plus the screen-shake strength, and ages them with game time (so they freeze on pause). Blood, gibs and sparks live in `particles.ts`, a fixed-size pool (1800) that reuses its slots, so a big fight makes no garbage and cannot grow without limit.
- `canvas-renderer/piece-motion.ts` — per-piece animations started by events: a pawn lunges at its target, a hit piece recoils and flashes, a landing piece slams down and squashes, a dead piece collapses where it stood. `draw-pose.ts` draws a sprite with that pose (the cheap path is a plain offset copy; only squashes use a canvas transform).
- `canvas-renderer/canvas-renderer.ts` — draws the board (the screen shake moves only the canvas, never the HUD or shop; the offset is whole pixels, because a fractional one makes the canvas resample every sprite and costs a third of the frame rate) at 2× resolution or more (so the sprites are 2× too), warning squares, pieces back to front (each pawn type on a disc in its own colour, from `art/type-colours.ts`; each special black type on a ring in its catalog colour), HP bars, the power-up orbs (blinking for their last 2 s) and a pale tint while Freeze runs; `draw-effect.ts` draws each effect.
- `audio/` — sound. `sounds-for.ts` turns battle events, shop actions and the end of a run into sound names (the battle never calls audio). `sound-player.ts` decides what actually plays: at most 3 copies of a sound per 100 ms, pitch varied by ±8%, master/effects/music volume, mute. `web-audio-output.ts` is the real sound maker (recipes in `sound-recipes.ts`, music in `music.ts`); it stays silent until the first click or key press, since browsers block sound before that. `audio-settings.ts` loads and saves the settings in localStorage and falls back to defaults if the browser blocks it (logged at `warn`).
- `dom-ui/settings-panel.ts` — the Settings button and its sliders: master, music and effects volume, mute, screen shake.
- `dom-ui/shop-screen.ts` — the shop between waves: offers with their animated portraits, the army with small icons, the army stats panel (a table that scrolls sideways inside its box on a phone) and the last wave's results, the next wave's pieces, "New black types this wave" and a collapsible list of the black types that could already have turned up, reroll and "start wave". It reports clicks as shop actions.
- `dom-ui/toast.ts` — the short message over the board: a power-up's name and effect, and "More black pieces incoming". It fades after about 2.6 s and is taken down when the shop or end screen opens.
- `dom-ui/skill-bar.ts` — the skill buttons under the board: the type's portrait, the skill's name, its cooldown in seconds and a recharge bar, and hotkeys 1–9. It reports which skill was asked for; the entrypoint queues it for the next step.

See `docs/spec.md`.

## Folder layout

```
index.html                  # page shell and styles: HUD, canvas, shop, end screen, startup error box
deploy/                     # server scripts: update-site.sh, rollback.sh, systemd timer + service
art-gallery.html            # dev page: every drawing at game size and as a portrait (not in the build)
src/
  main.ts                   # entrypoint: config, game loop, wiring
  art-gallery.ts            # entrypoint of art-gallery.html
  fonts.css                 # Cinzel and Crimson Pro, self-hosted from @fontsource
  config.ts                 # reads and validates VITE_* env vars
  debug-options.ts          # ?pawns= for a big starting swarm
  logger.ts                 # level-based console logger
  startup-error.ts          # error type for a page that cannot start
  rng.ts                    # seeded RNG for rule code
  tick-clock.ts             # real time → steps due, with speed and pause
  catalog/                  # pieces.ts (stats), black-types.ts, power-ups.ts, battle-rules.ts, shop-rules.ts, waves.ts
  board/                    # square.ts (squares, points), moves.ts (chess moves, hit squares)
  battle/                   # battle-state.ts, create-battle.ts, step.ts and one file per phase
  run/                      # run.ts (run state machine), wave-report.ts (what happened in a wave)
  shop/                     # shop.ts (offers, recruit, reroll, lock), shop-view.ts
  skills/                   # skills.ts (cooldowns, using a skill, the skill bar's view)
  balance/                  # headless bot runs and their report
scripts/
  balance.mjs               # `npm run balance`: loads src/balance through Vite and prints the report
  adapters/
    art/                    # drawings as SVG code, animation frames, palette, type colours, portraits
    canvas-renderer/        # canvas-renderer.ts, piece-art.ts, board-art.ts, effects.ts, draw-effect.ts
    dom-ui/
      hud.ts                # pawn count, wave, black pieces left, seed
      battle-controls.ts    # pause and speed buttons, Space to pause
      skill-bar.ts          # skill buttons with cooldowns and hotkeys 1–9
      toast.ts              # short messages over the board (power-ups, new pushes)
      shop-screen.ts        # the shop between waves
      end-screen.ts         # win / game-over screen: wave, biggest swarm, pieces taken, seed, "new run"
tests/                      # mirrors src/
docs/
  spec.md, tickets/, decisions/, screenshots/, prototype/
```

## Debugging

- Logs go to the browser console, prefixed `[pawn-swarm]`. Default level is `info`.
- Add `?debug=1` to the URL for debug logs, e.g. `http://localhost:5173/?debug=1`. Debug logs show every battle event (strike, hurt, death, drop, landing, stomp) with its step. That is a lot of logging in a big fight.
- Add `?pawns=300` to start every run with that many plain pawns (1–1000), to see how a big swarm plays and performs. Combine with `?debug=1` as `?pawns=300&debug=1`.
- Wave starts and ends, each push landing ("more black pieces incoming"), pause, resume and speed changes are logged at `info` with the step they happened on. The run's end logs the wave, biggest swarm and pieces taken.
- Each power-up a pawn picks up is logged at `info` as "power-up picked up" with the wave, the step and the power-up. Black type powers and orb drops are `debug` events (`battle black-power`, `battle orb-drop`).
- Each skill that fires is logged at `info` as "skill used" with the wave, the step it fired on and how many pawns took part. A press the rules refuse (on cooldown) is logged at `debug` as "skill not ready".
- The shop logs at `info` when it opens (offers and army), each recruit and reroll with the plain pawns before and after, and each lock toggle. Use `?pawns=60` to reach the shop with pawns to spend.
- **"shop action refused" in the console** — the shop screen offered a button the shop rules refuse, so the screen and `shop/shop.ts` disagree. The log has the action and the reason; nothing changed in the run.
- **"BoardFullError: Every square … is taken"** — a push or the wave table holds more black pieces than the 176 squares can fit. Lower the counts in `catalog/waves.ts`.
- **"RunStuckError" from `npm run balance`** — a run went on for over a million steps, so a rule is stuck (for example a piece that can never be reached). Replay that seed in the browser to watch it.
- **Replaying a battle** — the HUD and the end screen show the run's seed. Put it in `VITE_DEFAULT_SEED`, restart `npm run dev`, and the first run plays out exactly the same, as long as you make the same choices in each shop and fire the same skills on the same steps (see the "skill used" logs; by hand you won't hit the exact steps, so to replay skills exactly, feed the logged uses to `step` in a test with `skillsUsedAt`). "New run" picks a random seed. Speed and pauses don't change the result, so you can replay at 0.5× to watch a hard moment.
- **"Pawn Swarm could not start: VITE_… is missing"** — there is no `.env`, or it lacks that variable. Run `cp .env.example .env` and restart `npm run dev` (Vite only reads `.env` at startup).
- **"Pawn Swarm stopped: …"** — a rule threw during a battle and the game loop stopped. The console error has the seed, wave and step; replay that seed with `?debug=1` to see the steps before it.
- **No sound** — sound only starts after the first click or key press ("audio started" appears in the console at `info`). Check the Settings panel isn't muted, and that the music/effects sliders aren't at 0. A saved setting that cannot be read or written logs a `warn` ("could not read/save settings") and the defaults apply.
- **Frame rate drops in a big fight** — try `?pawns=300` in a late wave. Keep canvas draws at whole-pixel positions; a fractional canvas offset or scale on every sprite is what costs the most.
- **Blank page, no error** — open the console; a script error before startup would show there.
- **Checking the art** — open `http://localhost:5173/art-gallery.html` while `npm run dev` runs. It shows every drawing through the game's own sprite code at game size (one square = 48 CSS px), and as the live portrait the shop uses.
- **"Pawn Swarm could not start: The "…" drawing could not be loaded as an image"** — that drawing's SVG is broken. `npm test` checks every drawing is well formed; the art gallery shows which one fails.

## Decisions

See `docs/decisions/` for why things are the way they are:

- [0001](docs/decisions/0001-browser-canvas-no-engine.md) — browser demo in TypeScript + Canvas, no game engine
- [0002](docs/decisions/0002-capture-is-an-attack.md) — a capture is an attack; the attacker stays put (tick-based battle, replaced by the one below)
- [0002](docs/decisions/0002-real-time-fixed-step-battle.md) — real-time fixed-step battle instead of a tick-by-tick board game
- [0003](docs/decisions/0003-svg-drawings-baked-to-sprite-frames.md) — piece art is SVG code, baked into sprite frames at startup
- [0004](docs/decisions/0004-sound-made-in-code.md) — sound is made in code with Web Audio, not played from files

## Docs

- `docs/spec.md` — what the demo is
- `deploy/` — scripts and systemd units that publish the game on the homelab (see Deploy)
- `docs/art/` — the approved art direction and samples
- `GLOSSARY.md` — the game's words
