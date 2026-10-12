# ASCII Sky — spec

## Problem Statement

I want a flight simulator I can open in a browser and actually fly: take off, cruise over hills and a lake, and bring the Plane back down onto the Runway. Most browser flight games are either arcade toys where you can't stall or full simulators buried in procedures. I also want it to look like nothing else: the whole Screen, the 3D World included, drawn only with printable ASCII characters in one colour, like an old terminal. It should live on rickphobia.com so anyone with a link and a keyboard can play.

## Solution

ASCII Sky is a browser game at `rickphobia.com/ai-projects/ascii-sky/`. The player sits in the Cockpit view of a light propeller Plane parked on the Runway of the only Airport in a small, hand-made World. The World ahead is a real 3D scene, shown as characters from the Character ramp, light grey on black. Under it, the Instrument panel shows the six flight instruments plus RPM, throttle, flaps, brakes and a `[STALL]` warning, all in characters.

Flying is a light sim: lift, drag, thrust and gravity act on the Plane, so it can Stall, speed matters and landing takes skill, but the Plane is forgiving. It is Free flight: no goal, score or timer. A Flight ends in one of three ways. The player can land gently on the Runway (Landed), land gently on flat grass (Landed off-runway), or hit too hard, hit a hill or hit the lake (Crashed). An ASCII-art banner then shows the Touchdown stats, and `R` starts a new Flight on the Runway.

The game opens on an ASCII-art title screen with the key list. It pauses on `P`/`Esc` and when the tab is hidden. A WebAudio engine tone follows the RPM, and a horn sounds during a Stall. On a device without a keyboard, the game says it needs one.

## User Stories

### Starting

1. As a player, I want to open a link and play in my browser with no install, so that trying it costs nothing.
2. As a player, I want an ASCII-art title screen, so that I know what the game is before it starts.
3. As a player, I want the title screen to list every key, so that I can fly without guessing the controls.
4. As a player, I want to press any key to start, so that getting into the cockpit is one step.
5. As a player, I want sound to start when I press that key, so that the browser's autoplay rules don't silence the game.
6. As a phone or tablet user, I want a clear message that the game needs a keyboard, so that I don't sit looking at a Plane I can't control.

### The Screen

7. As a player, I want everything on the Screen to be printable ASCII characters, so that the game keeps its terminal look.
8. As a player, I want light-grey characters on black, so that it looks like a plain terminal.
9. As a player, I want the Screen to be a fixed grid of 120 by 45 characters scaled to fit my window, so that the layout looks the same on every monitor.
10. As a player, I want the Screen to keep its shape when I resize the window, so that characters never stretch, wrap or get cut off.
11. As a player, I want brighter surfaces drawn with denser characters from the Character ramp, so that I can tell hills, water, grass and sky apart without colour.

### Cockpit view

12. As a player, I want to see the World from the pilot's seat, so that it feels like flying, not watching.
13. As a player, I want the top of the nose cowling and the window frame drawn in characters, so that I have a fixed reference for the Plane's pitch.
14. As a player, I want the horizon to tilt when I bank, so that I can feel the Plane rolling.
15. As a player, I want the ground to rush closer as I descend, so that I can judge my height on approach.
16. As a player, I want to see the Runway clearly from a distance, so that I can line up for landing.
17. As a player, I want to see hills and the lake, so that the World has landmarks to fly around.

### Instrument panel

18. As a player, I want an airspeed indicator, so that I can stay above Stall speed.
19. As a player, I want an attitude indicator, so that I can see my pitch and bank even when the view is all sky or all ground.
20. As a player, I want an altimeter, so that I know my height above the Airport.
21. As a player, I want a turn coordinator, so that I can see how fast I'm turning and whether the turn is balanced.
22. As a player, I want a heading indicator, so that I can find the Runway again.
23. As a player, I want a vertical speed indicator, so that I can hold a gentle descent on approach.
24. As a player, I want to see RPM and the throttle setting, so that I know how much power I'm making.
25. As a player, I want to see the flaps position, so that I know whether they're set for landing.
26. As a player, I want to see whether the brakes are on, so that I don't try to take off with them set.
27. As a player, I want a `[STALL]` warning on the panel, so that I notice a Stall before the nose drops.
28. As a player, I want every instrument drawn in characters, so that the panel matches the rest of the Screen.

### Flying

29. As a player, I want the arrow keys to pitch and roll the Plane, so that I can climb, dive and bank.
30. As a player, I want `A`/`D` to use the rudder, so that I can steer on the ground and balance turns in the air.
31. As a player, I want `W`/`S` to raise and lower the throttle, so that I control my speed.
32. As a player, I want `F` to step the flaps, so that I can fly slower on approach.
33. As a player, I want `B` to apply the brakes, so that I can hold still on the Runway and stop after landing.
34. As a player, I want the Plane to roll forward and lift off when it's fast enough, so that taking off is something I do, not something that happens.
35. As a player, I want the Plane to Stall when it's too slow or the nose is too high, so that the flying has real limits.
36. As a player, I want to recover from a Stall by lowering the nose and adding power, so that a Stall is a mistake I can fix, not instant death.
37. As a player, I want a banked Plane to turn, so that turning works like a real aeroplane.
38. As a player, I want the Plane to be forgiving, so that a beginner can take off and land within a few tries.
39. As a player, I want flaps to lower my Stall speed and add drag, so that they matter on landing.
40. As a player, I want the Plane to steer and brake on the ground, so that I can roll to a stop on the Runway.
41. As a player, I want to be stopped at the edge of the World, so that I can't fly off into nothing.
42. As a player, I want calm daylight with no wind, so that the first version is about learning to fly.

### Ending a Flight

43. As a player, I want a gentle Touchdown on the Runway to end the Flight as Landed once I roll to a stop, so that a good landing is rewarded.
44. As a player, I want a gentle Touchdown on flat grass to end as Landed off-runway, so that a forced landing in a field still counts.
45. As a player, I want a Touchdown that is too hard, too steeply banked or nose-down to end as Crashed, so that landing needs care.
46. As a player, I want hitting a hill or the lake to end as Crashed, so that the World has real dangers.
47. As a player, I want a big ASCII-art banner saying LANDED, LANDED OFF-RUNWAY or CRASHED, so that the result is unmistakable.
48. As a player, I want the Touchdown stats (sink rate, speed, bank and distance from the Runway centreline) on the banner, so that I know how good the landing was and what to fix.
49. As a player, I want `R` to start a new Flight on the Runway, so that I can try again straight away.

### Pause

50. As a player, I want `P` or `Esc` to pause and resume, so that I can step away mid-Flight.
51. As a player, I want the game to pause when I switch tabs, so that I don't come back to a crash.
52. As a player, I want a clear PAUSED message, so that I know the game hasn't frozen.

### Sound

53. As a player, I want an engine tone that rises and falls with RPM, so that I can hear my power setting without looking.
54. As a player, I want a stall horn while the Plane is in a Stall, so that I notice it even when watching the World.
55. As a player, I want sound to stop while paused, so that the game is silent when I'm away.

### The owner

56. As the owner, I want the game deployed with the same update script pattern as pawn-swarm, so that publishing it is one command on the server.
57. As the owner, I want each PR to get a preview on the Beelink, so that I can fly a change before merging it.
58. As the owner, I want the game to log its start-up and any error to the browser console with clear messages, so that I can tell why a broken build shows a blank Screen.
59. As the owner, I want CI to run lint, type checks, unit tests and a smoke test on every push, so that a broken game never reaches `main`.

## Implementation Decisions

- **Stack:** TypeScript with `strict` on, built with Vite, linted with ESLint and formatted with Prettier, tested with Vitest, matching pawn-swarm. three.js is the only runtime dependency. No backend; the build is static files served by nginx under `/ai-projects/ascii-sky/`.
- **3D view (see decision 0001):** three.js renders the World from the cockpit camera into a small hidden render target with one pixel per character cell of the view area. The brightness of each pixel is read back and handed to the Game core as a brightness grid. three.js's own `AsciiEffect` is not used.
- **Game core:** one pure module with no three.js, DOM or audio. It owns the game state and has two entry points:
  - **Advance:** given the game state, the controls held down this moment, and the elapsed time, return the next game state. It runs the flight model in fixed small steps internally so results don't depend on frame rate.
  - **Draw:** given the game state and a brightness grid, return the Screen as exactly 45 lines of exactly 120 printable ASCII characters.
- **Game state** carries: the phase (title, flying, paused, ended), the Plane (position, velocity, attitude, angular rates, throttle, RPM, flaps setting, brakes, Stall flag, on-ground flag), the end of the Flight (Landed, Landed off-runway or Crashed) and the Touchdown stats once known. The core also exposes the cockpit camera pose so the three.js adapter can place its camera.
- **Controls** are a plain set of the actions held down this moment (pitch up/down, roll left/right, rudder left/right, throttle up/down, flaps step, brakes, pause, restart, start). Key-to-action mapping lives in the keyboard adapter, not the core.
- **Flight model:** a light sim for one Cessna-172-like Plane. It has lift from angle of attack with a Stall past a critical angle, drag rising with speed and flaps, thrust from throttle, gravity, and simple control responses with damping. Turning comes from bank. On the ground the Plane rolls on wheels with rolling friction, rudder steering and brakes. Tuning numbers live in one place in the core so they can be adjusted without touching the logic.
- **World:** one fixed, hand-made area, about 20×20 km, defined as data in the core: a ground-height function or height grid, and a surface type at each point (runway, grass, hill, lake). The edge of the World is a boundary the Plane cannot pass. The three.js adapter builds its meshes from the same World data, so what you see and what you hit can't disagree.
- **Ending rules:** a Touchdown is gentle when sink rate is below about 3 m/s, bank below about 10° and the nose is not down. Gentle on Runway, then rolling to a stop, ends Landed. Gentle on flat grass ends Landed off-runway. Anything else, or contact with a hill or the lake, ends Crashed. The exact limits are tuning numbers next to the flight model's.
- **Screen layout:** a fixed 120×45 grid. The top part is the Cockpit view with the cowling and window frame drawn over it; the bottom rows are the Instrument panel. Banners, the title screen and the PAUSED message are drawn into the same grid by Draw.
- **Character ramp:** ` .:-=+*#%@`, sparse to dense. Brightness maps linearly onto it. Only characters 32–126 ever appear.
- **Adapters (thin, wired by the entrypoint):**
  - three.js view renderer: builds the World scene once, places the camera from the camera pose, renders and reads back the brightness grid.
  - Keyboard: turns key events into the controls held down. Also detects a device without a keyboard so the entrypoint can show the needs-a-keyboard message.
  - Audio: a WebAudio oscillator whose pitch and volume follow RPM, plus a stall horn on while the Stall flag is set. It is started from the first key press and silenced while paused.
  - Screen output: writes the 45 lines into one `<pre>`, scaled with CSS to fit the window while keeping its aspect.
  - Page visibility: pauses the game when the tab is hidden.
- **Entrypoint:** a thin loop on `requestAnimationFrame`. Each frame it reads the controls, calls Advance, asks the three.js adapter for a brightness grid, calls Draw, writes the Screen, and updates the audio.
- **Config:** a config module holding the few settings that differ between environments (the base path the site is served under, a debug flag for verbose logging), read from Vite environment variables and validated at start-up. `.env.example` lists them.
- **Logging:** a small logger over the browser console with levels. It logs start-up (build version, Screen size, WebGL available), each Flight's end with its Touchdown stats at `info`, and any failure (no WebGL, render error) at `error` with what was being done.
- **Errors:** if WebGL is missing or three.js fails to start, the Screen shows a plain ASCII message saying so instead of a blank page.
- **Deploy:** `deploy/update-site.sh` and `deploy/rollback.sh` copied from pawn-swarm's pattern, and the project added to `web_projects` and `build_web` in `scripts/try-pr.sh` so PRs get a preview.
- **CI:** `.github/workflows/ascii-sky.yml`, `name: ascii-sky`, scoped to `projects/ascii-sky/**`, running lint, format check, type checks, unit tests, the build and the smoke test.

## Testing Decisions

- **What a good test is here:** it drives the Game core through Advance and Draw only, and checks what a player would notice: whether the Plane is airborne, whether the Stall flag is set, how the Flight ended, the Touchdown stats, and the characters on the Screen. Tests never reach into the flight model's internal steps or helper functions, so the maths can be retuned or rewritten without breaking them.
- **Game core through Advance (Vitest):**
  - On the Runway at full throttle, the Plane accelerates and lifts off within a sensible distance; with brakes on and idle throttle it stays put.
  - Pulling the nose up at low speed sets the Stall flag, and lowering the nose with power clears it.
  - Holding a bank makes the heading change.
  - A gentle, wings-level descent onto the Runway ends Landed after rolling to a stop, with Touchdown stats matching the approach.
  - The same Touchdown at a 30° bank, or at a high sink rate, ends Crashed.
  - A gentle Touchdown on grass ends Landed off-runway; reaching the lake or a hill ends Crashed.
  - The Plane cannot pass the World's edge.
  - Pause freezes the state; `R` after a Flight ends puts the Plane back on the Runway with a fresh state.
  - The same controls over the same time give the same result whatever the frame lengths, so the fixed-step loop works.
- **Game core through Draw (Vitest):** given a state and a brightness grid, the Screen is always 45 lines of 120 characters in the range 32–126. A uniform brightness grid shows the expected ramp character. The panel shows the right numbers for a known state, `[STALL]` appears only when the Stall flag is set, and the title screen, PAUSED message and each ending banner appear in their phases.
- **Smoke test (headless browser via Playwright):** loads the built page, presses a key, and checks the Screen is 45 lines of 120 characters with the view area not blank. It is the only test that proves three.js, the read-back and the wiring run. This adds Playwright and one browser download to CI.
- **Not tested automatically:** how the 3D picture looks, how the sound sounds and how the flying feels. These are checked by eye and ear on the PR preview on the Beelink.
- **Prior art:** pawn-swarm's Vitest tests on its pure battle logic (driving the simulation step by step and asserting on outcomes) are the model for the Game core tests. No TypeScript project here has a browser smoke test yet, so this one sets the pattern.

## Out of Scope

- The Outside view (the `V` key) and drawing the Plane itself.
- Gamepad and touch controls; phones only get the needs-a-keyboard message.
- Wind, clouds, weather, night and time of day.
- More than one Plane, more than one Airport, or endless terrain.
- Challenges, scores, rings, routes and combat.
- Saving anything between visits.
- Any AI at runtime, including an AI air-traffic controller.
- Colour, and any characters outside printable ASCII.
- Study-sim systems: engine start-up, trim, fuel, mixture, failures.

## Further Notes

- Later specs already named: Outside view; wind; gamepad and touch controls; challenges (land on target, rings) with a best-landing record; an AI air-traffic controller.
- The flight model's feel needs tuning by hand on the preview. Keep the tuning numbers together and log the Touchdown stats so tuning sessions have data.
- three.js adds noticeable bundle size to a text game; that's accepted in decision 0001.
