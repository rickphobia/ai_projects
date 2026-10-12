# My Piggy

A first-person horror game: you wake up as your own human head on a pig's body, and your family hunts you through the house in one long night. Built with Godot 4 and played in the browser. See `docs/spec.md` for the first playable.

## Status

`in progress` — tickets 01–09 are done: a title screen, a few seconds of black with breathing and a heartbeat, then you walk, creep or trot as the Piggy through a dark, foggy house with a PS1 look (bedroom, long hallway, kitchen), nudging doors open with your head, while your body's urge builds into snorts, squeals and lunges that you can hold back (Space) or quiet by giving in at a bowl or the bin (E). Wind, a fridge hum and the odd creak play underneath; sounds behind walls and closed doors are muffled. Each space you enter takes a checkpoint; the kitchen back door ends the night with an end card. Escape pauses, with sensitivity, volume and the controls. It deploys to `https://rickphobia.com/ai-projects/my-piggy/`. Mum walks her route through the kitchen and hallway humming "This Little Piggy"; your footsteps, door pushes, outbursts and giving in are noises she can hear (walls and closed doors cut them down), and when she does she comes to look, searches the spot for a while talking softly, then goes back to her route. She carries a torch: step into its beam with nothing in the way and she chases you, faster than you can trot. Break line of sight and keep quiet and she searches where she last saw you, then gives up. If she reaches you, you're caught: torch in your face, her face and a scream, then the space restarts from its checkpoint, with Mum back on her route, unaware and well out of sight. Giving in costs hidden humanity, and you feel it: the view blurs (pig vision), your breathing and heartbeat turn snouty, the slop bowls turn into your favourite snacks while you aren't looking, the hallway mirror stops flickering from your old body to the pig and shows only the pig, and the end card and the back-door glass change. The house rots too, room by room and only behind your back: cosy (amber lamps, warm walls, drawings, photos, a ticking clock and a TV through the wall), soured (sour colours, stains, flies, a drip) and grotesque (meat walls, green-brown lamps, pig-faced photos, wet breathing in the walls). The rot never changes how dark anything is. Props and sounds are placeholders.

## Requirements

- Linux or macOS shell (the setup script downloads the Linux x86_64 Godot; on another OS install the pinned Godot yourself)
- Godot **4.7.2** (stable), pinned in `scripts/godot-pin.env`, with its web export templates
- Python 3.11+ for the lint and format tools (`gdtoolkit`)
- `curl`, `unzip`, `sha512sum` for the setup script
- No accounts or API keys

## Setup

```bash
cd projects/my-piggy
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # gdformat, gdlint
scripts/setup-godot.sh                                              # Godot + web templates, checksum-verified
```

`setup-godot.sh` puts `godot` in `~/.local/bin` (change with `GODOT_INSTALL_DIR`); make sure that folder is on your `PATH`. The templates download is 1.3 GB because it holds every platform; only the web files are kept.

## Run

```bash
godot --path .          # play: click the title screen, then WASD to walk, mouse to look, Esc to pause
godot --path . -- --debug  # the same, with the debug overlay (humanity, urge, each space's rot stage, Mum's alert level, noise rings) and F9
godot --path . --editor # open the project in the Godot editor
```

Walk into a door to push it open; the faster you push, the louder it creaks. Leave the bedroom, go down the hallway into the kitchen and walk up to the back door (the one with the glass, far right) to end the night. Hold **Ctrl** or **C** to creep, **Shift** to trot. The urge builds on its own (faster while trotting); heavy breathing, a twitching view and a grunt warn you, then the body has an outburst. Hold **Space** at that moment to hold it back: you slow to a crawl, and the longer you hold, the louder it is when it comes. Press **E** at a give-in spot (the grey discs: a bowl in the bedroom, a bowl and the bin in the kitchen) to give in: two seconds with your face in the bowl, then the urge is gone. Each spot works once per checkpoint. Mum's torch is the only light she sees by: stay out of its beam, behind furniture or a closed door. To get into the kitchen, follow her down the hallway, wait at the door until she walks to the back wall with her back to you, then slip in and duck behind the low counter just right of the doorway. If she sees you she runs at you; get out of sight and stand still or creep, and she searches the spot where she last saw you. If she reaches you, you are caught and start the space again; she comes back unaware, somewhere along her route at least 8 m away. With the debug flag, **F9** puts you back at the checkpoint of the space you are in.

## Test

```bash
scripts/check.sh        # what CI runs: format check, lint, type check, tests (stops at the first failure)
```

Or one step at a time:

```bash
.venv/bin/gdformat --check src tests   # format check (drop --check to fix)
.venv/bin/gdlint src tests             # lint
godot --headless --import              # type check: "untyped declaration" and unsafe_* warnings are errors
godot --headless -s addons/gut/gut_cmdln.gd                                  # all tests
godot --headless -s addons/gut/gut_cmdln.gd -gselect=test_night   # one test file (part of its name)
```

`godot --headless --import` exits 0 even when a script has errors, so `scripts/check.sh` reads its output instead. Don't rely on the exit code alone.

## Export (web)

```bash
mkdir -p build/web
godot --headless --export-release Web build/web/index.html
python3 -m http.server --directory build/web 8000   # then open http://localhost:8000
```

The preset is single-threaded with the Compatibility (WebGL 2) renderer, so any static file server works with no special headers. The server must send `.wasm` files as `application/wasm`. The build is about 40 MB, mostly the engine.

The page around the game is `web/shell.html`: Godot's default web page with a "Loading My Piggy…" label under the progress bar and a plain-words message for browsers without WebGL 2. To try that message, start Chrome with `--disable-webgl2`.

CI (`.github/workflows/my-piggy.yml`) runs `scripts/check.sh`, the web export and `shellcheck` on every push that touches this folder.

## Deploy

The game is a static site, served at `https://rickphobia.com/ai-projects/my-piggy/` by nginx in Docker on the Beelink, with `~/homelab/html` as the site root. GitHub can't reach the home network, so the server pulls: you run one script there.

`deploy/update-site.sh` fetches `main` into `~/homelab/dev/ai_slops`, builds a small Docker image with the pinned Godot and its web export templates (`deploy/Dockerfile`, tagged with the Godot version, so it is built once per version), exports the web build inside it, copies the result to `~/homelab/html/ai-projects/my-piggy.new`, then renames it into place. The old build stays as `my-piggy.previous`. If any step fails, the script exits non-zero, names the step, and the live site stays as it was. If `main` hasn't moved since the last deploy, it does nothing.

### First-time setup (on the Beelink)

Needs `git`, `docker` (your user can run it without sudo) and `flock` (part of `util-linux`, already on Ubuntu). The checkout is shared with `pawn-swarm`; skip the clone if it is already there.

```bash
mkdir -p ~/homelab/dev && git clone https://github.com/rickphobia/ai_slops.git ~/homelab/dev/ai_slops
~/homelab/dev/ai_slops/projects/my-piggy/deploy/update-site.sh
```

The first run downloads the Godot export templates (1.3 GB) while building the image, so it takes a few minutes. Later runs reuse the image.

**One-time nginx check.** This was not checked from the development session (it can't reach the server). After the first run:

```bash
curl -I https://rickphobia.com/ai-projects/my-piggy/            # expect 200
curl -I https://rickphobia.com/ai-projects/my-piggy/index.wasm  # expect Content-Type: application/wasm
```

A `404` means nginx maps `/ai-projects/` somewhere other than `~/homelab/html/ai-projects/`; fix its `root`/`location` and reload nginx. A wrong `.wasm` type means nginx's `mime.types` is missing `application/wasm wasm;`; add it and reload. Record what you found here: checked 2026-10-03, the page returns `200` and `index.wasm` is served as `application/wasm`. Cloudflare sits in front of nginx (responses carry `server: cloudflare`).

### Browser caching (once, on the Beelink)

`index.html` and `index.pck` keep their names on every deploy, so without a `Cache-Control` header a browser may keep showing the previous build. `deploy/nginx.conf` makes browsers check with the server on each visit (a cheap 304 when nothing changed). Install it into the homelab's nginx drop-box, check it, and reload:

```bash
cp projects/my-piggy/deploy/nginx.conf ~/homelab/nginx/projects/my-piggy.conf
docker exec portfolio-nginx nginx -t && docker exec portfolio-nginx nginx -s reload
curl -sI https://rickphobia.com/ai-projects/my-piggy/index.pck | grep -i cache-control   # no-cache
```

The title screen's bottom-right corner shows which build is running (`main <commit> · <date>`; a PR preview shows `PR #<N> · <commit>`, a local or CI build `dev build`), so you can tell at a glance whether you have the latest.

### Cloudflare caching (optional)

By default Cloudflare does not cache `.wasm` files (`cf-cache-status: DYNAMIC`), so every visit downloads the 40 MB engine from the Beelink over the home upload. To have Cloudflare keep a copy instead, add a cache rule in the Cloudflare dashboard (rickphobia.com → Caching → Cache Rules → Create rule):

- **When:** URI Path starts with `/ai-projects/my-piggy/` **and** File extension is in `wasm`, `js`
- **Then:** Eligible for cache, Edge TTL 1 month

Only the engine files (`index.wasm`, `index.js` and the audio worklets) are cached. They change only when the Godot version in `scripts/godot-pin.env` changes. `index.pck` (the game itself) and `index.html` change on every deploy, so they stay uncached and a new deploy shows up at once. After a Godot version bump, purge the cache for `/ai-projects/my-piggy/` (Caching → Configuration → Custom Purge), or players get an old engine with a new game, which fails to start.

Check it: run `curl -I https://rickphobia.com/ai-projects/my-piggy/index.wasm` twice. The second should say `cf-cache-status: HIT`.

### Update

```bash
~/homelab/dev/ai_slops/projects/my-piggy/deploy/update-site.sh
```

To rebuild even though `main` hasn't changed: `MY_PIGGY_FORCE=1 ~/homelab/dev/ai_slops/projects/my-piggy/deploy/update-site.sh`.

Settings (all optional, shown with defaults in `.env.example`) are environment variables: `MY_PIGGY_REPO_URL`, `MY_PIGGY_BRANCH`, `MY_PIGGY_SRC_DIR`, `MY_PIGGY_SITE_ROOT`, `MY_PIGGY_SITE_SUBPATH`, `MY_PIGGY_FORCE`. The scripts do not read `.env`. The Godot version comes from `scripts/godot-pin.env`, the same pin CI uses.

### Roll back

```bash
~/homelab/dev/ai_slops/projects/my-piggy/deploy/rollback.sh
```

Swaps `my-piggy` and `my-piggy.previous`. Run it again to undo. The next `update-site.sh` run puts the latest `main` back, so fix `main` first.

### Check that it worked

```bash
curl -I https://rickphobia.com/ai-projects/my-piggy/   # expect HTTP 200
cat ~/homelab/dev/my-piggy.deployed-commit            # the commit that is live
```

Then open the URL, click the title screen and walk around.

## Configuration

The game reads no environment variables; the deploy scripts do (see "Deploy"). Game numbers live in one table, `data/tuning.tres` (a Godot resource, see `src/config/tuning.gd`). It is loaded and checked at startup: a missing or out-of-range value stops the game with a message that names the field.

| Field | What it does | Allowed range |
|-------|--------------|---------------|
| `walk_speed` | How fast the Piggy walks, metres per second | 0.1–10 |
| `mouse_sensitivity` | Radians the view turns per pixel of mouse movement, before the player's own setting | 0.0001–0.05 |
| `opening_seconds` | How long the opening lasts: black, breathing and a heartbeat before control is given | 0.5–20 |
| `door_creak_quietest_radius` | How far a door creak is heard when the door is barely pushed, metres | 0–30 |
| `door_creak_loudest_radius` | How far it is heard when pushed at `door_creak_loudest_speed` or faster, metres; not below the quietest | 0.1–30 |
| `door_creak_loudest_speed` | Push speed at which a door creaks its loudest, metres per second | 0.1–10 |
| `creep_speed`, `trot_speed` | Creep (Ctrl/C) and trot (Shift) speeds, m/s; creep ≤ walk ≤ trot | 0.1–10 |
| `urge_rise_at_rest`, `urge_rise_trotting` | How much the urge (0–100, outburst at 100) rises per second | 0.1–50 |
| `urge_warning` | Urge at which the warning signs start | 1–99 |
| `urge_after_outburst` | Urge left after an outburst; below `urge_warning` | 0–99 |
| `suppressed_rise_increase` | Each suppressed outburst raises the urge rise rate by this fraction, for the rest of the space | 0–1 |
| `suppress_speed_factor` | Speed while holding back an outburst, as a fraction of normal | 0–1 |
| `suppress_loudness_per_second` | How much louder the held-back outburst gets per second, as a fraction | 0–1 |
| `suppress_limit_seconds` | How long an outburst can be held back before it happens anyway | 0.5–30 |
| `give_in_seconds` | How long giving in takes (and the view is held in the bowl), seconds; kept short so it never reads as the game hanging | 0.5–10 |
| `give_in_humanity_cost` | Humanity (hidden, starts at 100) lost per give-in | 0–100 |
| `give_in_noise_radius` | How far giving in is heard, metres | 0–30 |
| `give_in_reach` | How close to a give-in spot the Piggy must be to press E, metres | 0.2–5 |
| `snort_radius`, `squeal_radius`, `lunge_radius` | How far each kind of outburst is heard, metres | 0–50 |
| `lunge_distance` | How far a lunge throws the Piggy forward, metres | 0–3 |
| `outburst_camera_jerk` | How far an outburst jerks the view, radians | 0–1 |
| `warning_camera_twitch` | How far the view twitches during the warning signs, radians | 0–0.2 |
| `creep_noise_radius`, `walk_noise_radius`, `trot_noise_radius` | How far each footstep is heard at that gait, metres (0 is silent) | 0–30 |
| `footstep_seconds` | Seconds between the Piggy's footstep noises while moving | 0.1–2 |
| `noise_cut_per_barrier` | How much each closed door or wall between a noise and Mum cuts its radius, as a fraction | 0–1 |
| `mum_walk_speed`, `mum_investigate_speed` | Mum's speed on her route and while searching, and going to a noise, m/s | 0.1–10 |
| `mum_search_seconds` | How long Mum searches around a noise before going back to her route | 1–120 |
| `mum_search_radius` | How far from the noise she looks while searching, metres | 0.5–10 |
| `snacks_below_humanity` | Below this humanity the slop bowls show snacks (and you crunch instead of slurp) | 0–100 |
| `mirror_pig_only_below_humanity` | Below this the mirror and back-door glass show only the pig, and the night ends on the pig end card | 0–100 |
| `mirror_old_body_seconds` | How long the mirror shows your old body before it flickers to the pig, seconds | 0.1–10 |
| `pig_vision_full_at_humanity` | Humanity at which pig vision (blur) is strongest; it grows evenly from 100 | 0–99 |
| `snouty_breathing_below_humanity`, `pig_breathing_below_humanity` | Below these, breathing and heartbeat sound snouty, then like a pig; pig ≤ snouty | 0–100 |
| `rot_soured_below_humanity`, `rot_grotesque_below_humanity` | Below these, a space out of view rots from cosy to soured, then grotesque; grotesque ≤ soured | 0–100 |
| `mum_line_seconds` | Seconds between Mum's lines while she investigates, searches or chases | 1–60 |
| `mum_chase_speed` | Mum's speed while chasing, m/s (keep it above `trot_speed`) | 0.1–10 |
| `mum_torch_cone_degrees` | How wide her torch beam is, edge to edge; she only sees the Piggy inside it | 1–170 |
| `mum_torch_range` | How far her torch reaches, metres; beyond it the dark hides the Piggy | 0.5–50 |
| `mum_caught_distance` | How close she must get while chasing to catch the Piggy, metres | 0.2–5 |
| `mum_restart_distance` | After a catch, Mum starts again on her route, unaware and out of sight, at least this far from the Piggy on foot, metres | 0–30 |

The player's own settings (mouse sensitivity as a multiplier of 0.25–3, master volume 0–1) are set in the pause menu and saved to `user://settings.cfg`, which the web build keeps in the browser. See `src/config/player_settings.gd`.

## How it works

The rules of the game live in plain classes that know nothing about the scene tree; Godot scenes are thin adapters around them. Like a referee and the players: the rules read what happened and decide, and never touch the ball.

- `src/main.tscn` is the entry scene. `src/main.gd` loads and checks the tuning and the player's settings, starts a `Night` (with the house's distances for hearing), spawns the Piggy and Mum in the house, shows the title screen, runs the opening, the pause menu and the end card, owns the mouse, and keeps the logger up to date. Each physics step it asks the house which space the Piggy is in and tells the Night.
- `src/rules/game_flow.gd` — title screen, opening, playing, paused, ended: when the player has control.
- `src/rules/night.gd` — one playthrough. The main test seam. It knows the current space, moves the body on each step, has Mum look for the Piggy, takes a checkpoint (`src/rules/checkpoint.gd`: the space, the Piggy's `PiggyPose`, and the body's state; not Mum) on entering a new one, signals `caught` when Mum reaches the Piggy while chasing, restores the checkpoint (putting Mum back on her route at a `RouteSpot`), and ends at the back door.
- `src/rules/route_spot.gd` — where Mum starts again after a catch: the first spot along her route, in walking order, at least `mum_restart_distance` from the Piggy on foot and outside her torch beam (the farthest out-of-sight spot if none is that far).
- `src/rules/torch_sight.gd` — whether Mum's torch shows her the Piggy: inside `mum_torch_cone_degrees` (measured flat on the floor) and `mum_torch_range`, with a clear view asked of the `DistanceProvider`.
- `src/rules/body.gd` — the pig body: urge, hidden humanity, outbursts, suppressing and giving in. Each step returns `BodyEvent`s (`body_event.gd`), each with a position and a loudness (noise radius) for the noise ticket. `body_state.gd` is its part of a checkpoint. The Night owns it.
- `src/rules/door_creak.gd` — how loud a door push is: a noise radius from the push speed.
- `src/rules/piggy_noise.gd` — a **noise**: what made it, where, and how loud (a radius in metres). Made from footsteps (by gait), the Piggy's door pushes and body events. Decides whether a listener hears it from the `SoundPath` (`sound_path.gd`: path distance and the closed doors and walls in between) that a `DistanceProvider` (`distance_provider.gd`) gives; each barrier cuts the radius by `noise_cut_per_barrier`. Named `PiggyNoise` because Godot already has a `Noise` class. The Night makes the noises and hands each one Mum hears to her brain (`heard_noise.gd`).
- `src/rules/hallucinations.gd` — what isn't real, by humanity: what each lying object shows (slop or snacks, old body or pig in the mirror and the back-door glass), how strong pig vision is, which breathing set plays, each space's rot stage, and the ending. A lying object or a space only changes while it is out of view (restoring a checkpoint puts the whole house's rot back at once, under the capture scene); the mirror's flicker to the truth is the one change you see. The Night owns it (`night.look()` each step, `night.ending()` at the back door).
- `src/rules/family_brain.gd` — one family member's alert level (unaware → investigating → searching → unaware after `mum_search_seconds`) and where they are headed. The Night owns Mum's.
- `src/rules/family_brain.gd` — one family member's alert level (unaware → investigating → searching → unaware after `mum_search_seconds`; seeing the Piggy → chasing, losing sight → searching the last seen spot; noises don't interrupt a chase) and where they are headed, including the route point they walk to next. The Night owns Mum's.
- `src/config/tuning.gd` — the tuning table and its checks.
- `src/config/player_settings.gd` — the player's sensitivity and volume, kept between visits.
- `src/adapters/piggy_controller.gd` — first-person movement (creep, walk, trot) and mouse look, via the input map in `project.godot`; pushes the doors it walks into; lunges, camera jerks and twitches, and the head pressed into the bowl while giving in, when main says the body did them.
- `src/adapters/body_sounds.gd` — the body's own sounds: heavy breathing and heartbeat (human, snouty or pig set), grunt, snort, squeal, chewing slop or crunching snacks.
- `src/adapters/debug_overlay.gd` — humanity, urge, each space's rot stage and Mum's alert level in a corner, only with `?debug=1` in the URL or `-- --debug` on the command line. With it, `noise_rings.gd` draws a ring for each noise the Piggy makes, as wide as its radius: red if Mum heard it.
- `src/adapters/house_distances.gd` — the house's `DistanceProvider`: path distance over the walkable area, and the walls and closed doors on the straight line between the two points (rays at head height). The only part of hearing that uses Godot. Also answers whether Mum's torch has a clear view of the Piggy (a ray from torch height to the Piggy's body; walls, closed doors and furniture block it).
- `src/adapters/capture_scene.gd` — being caught: a white flash, Mum's placeholder face with a scream, black; about 1.7 s, then main restores the checkpoint.
- `src/adapters/mum.gd` — Mum's body (a grey capsule for now): walks where her brain says over the walkable area (running at `mum_chase_speed` in a chase), carries a torch (a spotlight matching her sight cone), tells the brain which way she faces, pushes doors she walks into (her own pushes are not noises), hums while unaware and says placeholder lines while investigating or searching, in a higher voice when she has just heard you. Her humming, footsteps and voice are 3D sounds on the muffled channel.
- `src/adapters/house.tscn` + `house.gd` — the grey-box house: the three spaces, a box per space under `SpaceBounds` (they meet in the middle of the wall between), the back-door exit, and the walkable area for pathfinding (`Walkable`, baked from the CSG collision shapes when the house loads). The only file that knows the layout. Later tickets attach to its named markers under `Markers`: `PiggySpawn`, `GiveInSpots/BedroomBowl`, `GiveInSpots/KitchenSlopBowl`, `GiveInSpots/KitchenBin`, `HallwayMirror`, `BackDoorGlass` (both facing into the room), `MumStart`, and `MumRoute/Point1…Point5` in walking order.
- `src/adapters/door.tscn` + `door.gd` — a door that swings away from the push and creaks once per push; its `creaked` signal carries the noise radius and who pushed it.
- `src/adapters/end_card.gd` — the end card; its heading and a line about the back-door glass change with the ending.
- `src/adapters/lying_objects.gd` — puts a `SlopBowl` (`slop_bowl.gd`: slop with flies, or snacks) on each slop bowl and a `Reflection` (`reflection.gd`: the old body or the pig, placeholder shapes from `plain_shapes.gd`) on the mirror and back-door glass; each physics step it tells the Night which ones the camera can see (any of a few points around each one in its view with nothing solid in between, so a half-visible object never changes) and shows what Hallucinations says.
- `src/adapters/title_screen.gd`, `src/adapters/pause_menu.gd` — the two menus, built in code.
- `src/adapters/placeholder_sounds.gd` — synth breathing, heartbeat, creaks, wind, fridge hum, body sounds and Mum's humming, lines and footsteps, until real sounds arrive.
- `src/adapters/look/` — the PS1 look. `ps1_surface.gdshader` (vertex wobble, a tiny unfiltered grime texture in world space) is used by the materials `plaster`, `wood`, `glass` and `fridge` (`.tres`); `ps1_screen.gd` + `ps1_screen.gdshader` is a full-screen pass for low resolution, few colours and dithering, and the pig vision blur (`pig_vision` uniform, set each step from humanity). Fog, darkness and the lamps and moonlight are set in `house.tscn` (`WorldEnvironment`, `*Lamp`, `Moonlight`).
- `src/adapters/sound_occlusion.gd` — the muffled channel: each physics step it casts a ray from the Piggy's camera to every registered 3D sound and sends it to the `Muffled` bus (low-pass, quieter, defined in `default_bus_layout.tres`) when a wall or closed door is in the way. Register new 3D sounds (Mum, body sounds) with `register()`.
- `src/adapters/ambient_bed.gd` — wind, the fridge hum (`FridgeHum` in the house) and random creaks near the player, plus each space's rot sound set (`placeholder_rot_sounds.gd`: homely, souring, wet) from its middle, all through the muffled channel; no music.
- `src/adapters/look/rot_sets.gd` — shows each space at its rot stage: wall and floor colour, lamp colour (each scaled to the brightness of the one in `house.tscn`; lamp energy and placement never change) and props (`rot_props.gd`, placeholder panels with no shadows). Each physics step it tells the Night which spaces the camera can see into: the one it is in, and any whose middle or corners it can see.
- `src/adapters/game_log.gd` — the logger. Levels are debug, info, warning and error; every line carries the step and space name: `[info] step=0 space=bedroom Night started`.

## Folder layout

```
project.godot, export_presets.cfg   # Godot settings; web export preset
data/tuning.tres                    # the tuning table
default_bus_layout.tres             # audio buses: Master and Muffled
CREDITS.md                          # every outside asset and its licence
src/
  main.gd, main.tscn                # entry scene
  config/                           # tuning table and its checks
  rules/                            # Night, body, noise, family brain, checkpoints, GameFlow: pure rules, no scene tree
  adapters/                         # house and doors, piggy controller, menus, end card, sounds, logger
    look/                           # PS1 shaders and materials
tests/                              # mirrors src/ (GUT)
addons/gut/                         # GUT 9.7.1, the test framework (vendored, unmodified)
scripts/                            # check.sh, setup-godot.sh, godot-pin.env (the pinned version)
deploy/                             # update-site.sh, rollback.sh, Dockerfile (server deploy)
web/shell.html                      # the web page around the game
docs/                               # spec, tickets, decisions
```

## Debugging

- Logs go to Godot's output: your terminal when you run `godot --path .`, or the browser console in the web build.
- The game does not start if the tuning table is wrong. The message on screen and in the log names the field.
- `godot --headless --import` printing `SCRIPT ERROR ... has no static type` means a declaration is missing its type. Add one.
- Web build is blank: check the browser console, and check that `.wasm` is served as `application/wasm`.
- Mouse won't capture after resuming: some browsers refuse for a moment after Escape. Click the game to capture it.
- Hallucinations: with `?debug=1` watch humanity; slop turns to snacks below `snacks_below_humanity` only once you look away from the bowl. The ending is logged: `Reached the back door: night over, pig ending`.
- Body: add `?debug=1` to the URL (or run `godot --path . -- --debug`) to see humanity and urge. Outbursts and give-ins are logged at info level with their noise radius; warnings and suppressing at debug.
- Checkpoints: the log says `Entered hallway: checkpoint taken` and `Checkpoint restored: back to the start of hallway`; being caught logs `Caught by Mum` first. A checkpoint is taken when you enter a space; it does not keep Mum, so even if she chased you in, the restart puts her back on her route, unaware and out of sight. Door creaks are logged at debug level with their noise radius.
- The house layout lives in `src/adapters/house.tscn`. If you move walls, also move the matching box under `SpaceBounds`, or space changes happen in the wrong place; `tests/adapters/test_house.gd` checks the markers sit in the right spaces and that Mum can walk her route, and `tests/adapters/test_house_distances.gd` checks that each loop of her route turns her back on the kitchen doorway for long enough and that the cover just inside it stays out of her torch.
- Too dark or too bright: the ambient light and fog are on `WorldEnvironment` in `house.tscn`, the lamps are `BedroomLamp`, `HallwayLamp`, `KitchenLamp` and `Moonlight`. The PS1 strength is in the shader uniforms (`snap_grid`, `pixel_size`, `colour_levels`).
- A sound isn't muffled behind a wall: it must be registered with `SoundOcclusion`, and the wall must have collision (`use_collision` on CSG).
- Deploy failed: the last line of `update-site.sh` names the step. The live site was left as it was.

## Decisions

See `docs/decisions/` for why things are the way they are. Pinned versions are in `scripts/godot-pin.env` (Godot), `requirements.txt` (gdtoolkit) and `addons/gut/plugin.cfg` (GUT).
