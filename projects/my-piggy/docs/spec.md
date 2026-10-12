# My Piggy — first playable spec

Written on 2026-10-03 from the grilling session. Words in **bold** are defined in `GLOSSARY.md`. All numbers are starting values that live in one tuning table, not in the logic.

## Problem Statement

I want to make an original horror game that is scary because of atmosphere, not jumpscares, and that I could one day sell on Steam. The blind-echolocation idea I started with already exists (*Perception*, *Dark Echo*). What I liked in *Endoparasitic* is being trapped in a body that is hard to control. Before spending months on art, story and levels, I need to know whether the core idea is actually scary: **your own body gives you away, and the only way to quiet it is to lose yourself.** I need that answer as a link I can send to friends, not a download.

## Solution

**My Piggy** is a first-person horror game. You wake up in your childhood bedroom with your own human head on a pig's body. Your family is hunting you through the house in one long night. Mum hums "This Little Piggy" as she searches and calls you "my piggy".

Your body acts on its own. Its **urge** builds until it has an **outburst** (a snort, a squeal, a lunge) that **family members** can hear. You can **suppress** an outburst by holding a key, which keeps you human but slows you down and doesn't make the urge go away. Or you can **give in** — eat the **slop**, root in the bin — which quiets the body but costs **humanity**. Humanity is never shown. You notice it by what the game shows you: at high humanity the slop looks like rotten slop; as it drops, the slop starts to look like your favourite snacks, and **reflections** stop showing your old face. The house itself **rots** around you: it starts as a cosy family home at night and sours, room by room, into a grotesque flesh-house, while the slop looks more and more like comfort.

So the more you give in, the safer you are right now and the less you are yourself.

This spec covers the **first playable**: one night in three **spaces** (bedroom, hallway, kitchen), with Mum as the only family member, about 10 minutes long, playable at `rickphobia.com/ai-projects/my-piggy/`. If this slice isn't scary, nothing else will save it. The full game (upstairs, basement, the lab story, the rest of the family, endings) is described under Further Notes and gets its own specs later.

## User Stories

### Starting the game

1. As a player, I want to open a link and play in my desktop browser with no install, so that trying the game costs me nothing.
2. As a player, I want a title screen that says headphones are recommended, so that I hear the game the way it is meant to be heard.
3. As a player, I want a short content note on the title screen (body horror, implied violence), so that I can choose whether to play.
4. As a player, I want to click once to start, so that the browser allows sound and mouse capture.
5. As a player, I want a loading indicator while the game downloads, so that I don't think the page is broken.
6. As a player on an unsupported browser (no WebGL 2), I want a clear message instead of a black screen, so that I know what to do.
7. As a player, I want the opening to be a few seconds of black with breathing and a heartbeat before my eyes open, so that the mood is set before I can move.

### Moving and looking

8. As a player, I want to look around with the mouse and move with WASD, so that the controls feel familiar.
9. As a player, I want a slow, quiet creep (hold Ctrl or C), so that I can sneak past Mum.
10. As a player, I want a fast trot (hold Shift) that is loud on wooden floors, so that running is a real choice with a cost.
11. As a player, I want to see my trotters and the edge of my snout when I look down, so that I always feel the wrong body.
12. As a player, I want the camera to sit low (pig height) and sway with a heavy, uneven gait, so that moving feels animal and clumsy.
13. As a player, I want to push doors open with my head, so that I can get between spaces without hands.
14. As a player, I want doors to creak louder the faster I push them, so that even opening a door is a risk.
15. As a player, I want Escape to pause and release the mouse, so that I can stop safely.
16. As a player, I want a mouse sensitivity setting and a volume setting in the pause menu, so that I can play comfortably.
17. As a player, I want the controls listed in the pause menu, so that I can check them without leaving the game.

### The body

18. As a player, I want my body's urge to build up on its own over time, so that I am never fully in control.
19. As a player, I want clear warning signs before an outburst (heavier breathing, the camera twitching, a low grunt in my ears), so that I have a chance to react.
20. As a player, I want the outburst to happen on its own if I do nothing, so that ignoring the body has a cost.
21. As a player, I want an outburst to make a loud noise at my position, so that it can bring Mum to me.
22. As a player, I want some outbursts to jerk the camera or lunge me a short distance, so that the body physically fights me.
23. As a player, I want to hold Space to suppress an outburst, so that I can stay quiet at the worst moment.
24. As a player, I want to move very slowly while suppressing, so that suppressing is not free.
25. As a player, I want suppressing to only delay the outburst, not clear the urge, so that I can't suppress forever.
26. As a player, I want an outburst after a long suppress to be louder, so that bottling it up is a gamble.
27. As a player, I want urges to come faster the more I resist, so that the body fights harder when I fight it.
28. As a player, I want to give in at a give-in spot (press E at a slop bowl or the bin), so that I can quiet the body when I need to.
29. As a player, I want giving in to clear the urge almost silently, so that it is the safe choice in the moment.
30. As a player, I want giving in to cost humanity, so that the safe choice has a price.
31. As a player, I want the giving-in animation to be uncomfortable (wet chewing, the camera pressed into the bowl, a few seconds where I can't look away), so that I feel what I just did.

### Humanity and hallucinations

32. As a player, I want humanity to be hidden, so that I learn about it through the world and not a meter.
33. As a player, I want pig vision to get blurrier as humanity drops, so that I can feel myself slipping.
34. As a player, I want slop to look and sound like rotten slop at high humanity, so that giving in feels disgusting.
35. As a player, I want slop to look like my favourite snacks once humanity drops, so that giving in starts to feel like comfort, which is worse.
36. As a player, I want the change between slop and snacks to happen when I'm not looking at it, so that I'm never sure it changed.
37. As a player, I want the hallway mirror to briefly show my old human body at high humanity before it flickers to the truth, so that the reveal hits hard.
38. As a player, I want the mirror to show only the pig body at low humanity, so that the loss is visible.
39. As a player, I want my own breathing and heartbeat to sound more like a pig's as humanity drops, so that the change reaches my ears too.
40. As a player, I want the house to start as a cosy family home at night (warm lamps, saturated colours, kids' drawings and family photos, a ticking clock, a TV murmuring through a wall), so that it feels like home before it turns on me.
41. As a player, I want the house to rot as humanity drops, from cosy to soured (sour colours, stains, grime, flies) to grotesque (wet meat walls, sickly green-brown lamps, family photos with pig faces, dripping, wet breathing in the walls), so that I can see and hear what I'm becoming.
42. As a player, I want a space's rot to change only while I'm not looking at it, so that rooms change behind my back and I'm never sure when.
43. As a player, I want the slop to look more like snacks while the house rots, so that the thing destroying me is the only comfort left.
44. As a player, I want the rot to change only colours, textures, props and sounds, never how dark the hiding places are, so that giving in doesn't quietly make stealth easier or harder.

### Mum

45. As a player, I want to hear Mum before I see her (humming "This Little Piggy", footsteps, calling "my piggy"), so that sound tells me where she is.
46. As a player, I want Mum to walk a route through the spaces when she hasn't heard me, so that the house feels lived in and dangerous.
47. As a player, I want Mum to come to where she heard a noise, so that my noise has consequences.
48. As a player, I want louder noises to be heard from further away, and walls and closed doors to muffle them, so that position and doors matter.
49. As a player, I want Mum to search around a noise for a while before giving up, so that hiding near the spot is tense.
50. As a player, I want Mum to carry a torch, and only see me if I'm in its beam with nothing in the way, so that darkness and furniture protect me.
51. As a player, I want Mum to chase me when she sees me, so that being seen is terrifying.
52. As a player, I want to be able to escape a chase by breaking line of sight and staying silent, so that a chase isn't automatically a loss.
53. As a player, I want Mum's humming to stop and her voice to change when she is searching or chasing, so that I can hear her alert level without any UI.
54. As a player, I want Mum to talk to me while she searches ("Come to Mummy", "It's alright, my piggy"), so that she is scary because she sounds loving.

### Getting caught

55. As a player, I want being caught to play a short capture scene (Mum's torch in my face, her face, her scream, cut to black), so that it is horrible but quick.
56. As a player, I want to restart from the start of the space I'm in, so that I don't replay the whole night.
57. As a player, I want everything reset to how it was when I entered that space (my humanity, urge, give-in spots), and Mum back on her route, unaware, out of sight and well away from me, so that a restart is fair, can't be used to cheat, and never ends in being caught again straight away (even when she chased me into the space).
58. As a player, I want restarts to be fast (under 3 seconds), so that fear doesn't turn into boredom.

### The spaces

59. As a player, I want the bedroom to be a safe-ish place to learn the body (a give-in spot, a door, no Mum inside at first), so that I learn the controls before the danger.
60. As a player, I want the hallway to be long, with the mirror and Mum's route passing through it, so that it is the first real test.
61. As a player, I want the kitchen to have a slop bowl, the bin, hiding spots under the table, and the back door, so that it is the climax of the slice.
62. As a player, I want the back door to end the first playable, so that the slice has a goal.
63. As a player, I want the end card to change slightly with my humanity (one line of text and what the last reflection in the door glass shows), so that I feel my choices mattered.
64. As a player, I want the end card to say this is a first playable and invite feedback, so that friends know what they played.

### Look and sound

65. As a player, I want a PS1-style look (low-poly models, wobbling textures, dithering, fog), so that the cheap art looks deliberate and creepy.
66. As a player, I want the house to be night-dark, lit by a few lamps, the moon, and Mum's torch, with the same dark hiding places at every stage of the rot, so that light is both safety and danger.
67. As a player, I want 3D sound (left/right, near/far, muffled through walls), so that I can play by ear.
68. As a player, I want a quiet ambient bed (the house creaking, a fridge hum, wind, plus the rot's homely or wet sounds), so that silence still feels alive.
69. As a player, I want no music during play except Mum's humming, so that the atmosphere comes from the house.

### Owner and developer

70. As the owner, I want the game deployed by the same pull-and-build script approach as `pawn-swarm`, so that updating the site is one command on the server.
71. As the owner, I want a debug overlay (humanity, urge, rot stage, Mum's alert level, noise rings) that I can turn on with `?debug=1` in the URL, so that I can test and tune without guessing.
72. As the owner, I want all tuning numbers in one tuning table, checked at startup, so that I can tune the game without editing the logic and a typo fails loudly.
73. As the owner, I want logs with levels (debug, info, warning, error) in the browser console, saying which space, what step and what failed, so that I can debug a friend's report.
74. As a developer, I want the game rules testable without opening the Godot editor or running a scene, so that tests are fast and run in CI.
75. As a developer, I want CI to lint, type-check, test and build the web export on every push that touches the project, so that a broken build never reaches `main`.
76. As a developer, I want the exact Godot version, the test addon version and the lint tool version pinned, so that a new machine gets the same results.
77. As a developer, I want a README that gets me from clone to running, testing and exporting, so that I can work without asking anyone.

## Implementation Decisions

### Engine and platform

- **Godot 4, one exact pinned version**, chosen in ticket 01 as the latest stable 4.x at that time (decision 0001). GDScript only, no C#, because C# can't export to the web.
- **Web export, single-threaded, Compatibility (WebGL 2) renderer.** nginx serves plain static files with no special headers. Target: desktop Chrome and Firefox, 60 fps on a mid-range laptop. Safari, mobile and gamepads are out of scope.
- **Static typing everywhere.** Godot's "untyped declaration" warnings are raised to errors, which plays the role of `strict` in TypeScript.
- **Lint and format** with `gdtoolkit` (`gdlint`, `gdformat`), pinned in a requirements file inside the project folder.

### Structure: rules core and Godot adapters

The rules of the game live in plain GDScript classes that don't depend on the scene tree, nodes, physics, rendering or audio. Godot scenes are adapters: they read input and the world, feed them to the rules, and act on what the rules say. It works like a referee and the players: the referee (the rules core) only reads what happened and gives decisions, and never touches the ball.

Rules modules (pure, unit-tested):

- **Tuning.** One tuning table (a Godot resource) holding every number below. Loaded and checked at startup; a missing or out-of-range value stops the game with a clear message naming the field.
- **Body.** Holds urge and humanity. Each step takes the time passed plus what the player is doing (moving speed, suppressing, giving in) and returns events: urge rising, outburst warning, outburst (with loudness), suppression held, gave in, humanity changed.
- **Noise.** Turns body events and movement into **noises** with a position and a loudness. Decides who hears a noise using a distance it is given by the adapter (path distance through the house, with a muffling cost per closed door and wall). The rules don't compute geometry themselves.
- **Family brain.** One instance per family member. Takes perceptions (heard a noise at X, sees the Piggy, lost sight, reached destination) and returns intents (walk route, go to X, search around X, chase, catch). It owns the **alert level**: unaware → investigating → searching → chasing, and back down over time.
- **Hallucinations.** Given humanity and whether the player is looking, decides what each lying object shows: slop or snacks, old face or pig body in the mirror, each space's **rot** stage, how strong pig vision is, and which breathing sound set plays. Changes only when the object or space is out of view.
- **Night.** Ties the above together for one night: current space, checkpoints taken on entering a space, being caught, restoring a checkpoint, reaching the back door, and the end-card variant. **This is the main test seam** (see Testing Decisions).

Godot adapters (thin, smoke-tested):

- **Piggy controller.** First-person movement, mouse look, low camera, gait sway, door pushing, give-in interaction. Reads input through Godot's input map (no hard-coded keys in logic).
- **Family member actor.** Moves Mum with Godot's navigation, plays her lines and humming, casts her torch and checks line of sight, reports perceptions to her family brain.
- **House distance provider.** Answers "how far is this noise from this listener, and through how many doors and walls", using the navigation mesh. The Noise module depends only on this question, not on Godot.
- **Look.** PS1 shader (vertex wobble, low-res textures, dithering, fog) the pig vision post-effect, and each space's rot set (materials, lamp colours, props), driven by values from Hallucinations.
- **Sound.** 3D players, a muffled bus for sounds behind walls, ambient bed with a sound set per rot stage, body sounds, Mum's voice. Driven by events from Body, Family brain and Hallucinations.
- **Capture scene and end card.** Short scripted scenes triggered by Night.
- **Debug overlay.** Shown only with `?debug=1` (web) or a command-line flag (desktop).
- **Logger.** A small project logger with levels on top of Godot's printing. Every line carries the space name and the step. No player data exists to leak.
- **Main.** The entry scene: loads and checks the tuning, wires the rules to the adapters, starts the night. Kept thin.

### Rules (starting values, all in the tuning table)

- **Humanity:** starts at 100, never goes back up in the first playable. Giving in costs 12. Hallucination thresholds: slop shows as snacks below 70; the mirror stops showing the old face below 55; pig vision is at full strength by 20. Rot: cosy at 70 and above, soured from 69 to 40, grotesque below 40. Rot follows current humanity, so being caught restores the checkpoint's stage.
- **Urge:** 0–100, rises 4 per second at rest, 6 while trotting. Warning signs start at 70; outburst at 100. After an outburst the urge drops to 30.
- **Resisting makes it worse:** each suppressed outburst raises the urge rise rate by 10% for the rest of the space.
- **Suppress:** while held at or above 100 urge, the outburst waits; movement drops to 25% speed. Each second held adds 15% to the next outburst's loudness. If held past 6 seconds, the outburst happens anyway at that raised loudness.
- **Give in:** takes 2 seconds at a give-in spot, drops the urge to 0, and makes a quiet noise (radius 2 m). Each give-in spot can be used once per checkpoint.
- **Noise radii (heard distance before muffling):** creep 0 m, walk 3 m, trot 9 m, door push 2–8 m by speed, snort outburst 12 m, squeal outburst 22 m. Each closed door or wall between the noise and Mum cuts the radius by 40%.
- **Mum:** walks at 1.4 m/s on her route, 2.0 m/s when investigating, 3.6 m/s when chasing (the Piggy trots at 3.2 m/s, so you can't simply outrun her). Torch cone 35°, 10 m range. She searches for 20 seconds before going back to her route; after losing sight in a chase she searches the last seen spot.
- **Caught:** Mum within 1 m of the Piggy while chasing.
- **After being caught:** the checkpoint does not keep Mum. She comes back unaware, walking her route, at least 8 m from the Piggy on foot and not seeing them, with nothing remembered of where they were; she hunts again only if the Piggy makes a noise she hears or steps into her torch beam. None of her route points is within 3 m of where a space's checkpoint is taken.
- **Getting into the kitchen:** each loop of her route she spends at least 8 seconds in the kitchen with her torch off the doorway and the first metre inside it (she walks to the back wall), and just inside the doorway there is cover (a counter) her torch never finds on her route.

### Content and assets

- Free assets with licences checked and listed in a credits file (Kenney, Quaternius, Poly Pizza for models; Freesound for sounds). Each asset's licence is recorded when it is added.
- Custom-made: the Piggy's body seen in the mirror and when looking down, Mum's face for the capture scene, the slop and snack versions of the bowl, the three rot sets (cosy, soured, grotesque) for each space, the body sounds and Mum's lines and humming. Placeholders (grey boxes, synth sounds) are fine until the custom versions exist. Tickets must not block on art.
- "This Little Piggy" is a traditional nursery rhyme in the public domain; the recording is our own.

### Deploy

- Same model as `pawn-swarm`: a script in the project's deploy folder pulls `main` on the server, exports the web build inside a pinned container that has the pinned Godot version and its export templates, and swaps the result into `~/homelab/html/ai-projects/my-piggy/`. The old build is kept for rollback, and a failed step leaves the live site as it was.
- `.env.example` lists the deploy script's settings, the only environment variables the project reads.

### CI

- `.github/workflows/my-piggy.yml`, scoped to `projects/my-piggy/**` with `paths:`. It runs:
  - `gdformat --check` and `gdlint`;
  - Godot headless import with warnings-as-errors (the type check);
  - the unit tests;
  - the smoke test;
  - a web export, to prove it still builds;
  - `shellcheck` on the deploy scripts.
- The Godot binary and export templates are downloaded from the official release for the pinned version and checked against a pinned checksum.

## Testing Decisions

- **Seams (please confirm):**
  1. **Night** is the main seam. Tests drive it with scripted input over time (e.g. "stand still for 25 s, don't suppress") and a fake house distance provider, then assert the outcome ("an outburst happened, Mum heard it, Mum's alert level is investigating"). Body, Noise, Family brain and Hallucinations are tested through Night wherever possible. A module gets its own tests only when going through Night would be awkward, such as the threshold edges in Hallucinations.
  2. **One smoke test** that boots the main scene headless, runs a few seconds of scripted input, gets caught on purpose, and checks that the space restarts with no errors logged. It catches broken wiring between the rules and the adapters, which unit tests can't.
- **A good test** describes something a player would notice, using the glossary words: "giving in at the slop bowl clears the urge and costs humanity", "suppressing for 7 seconds still causes a louder outburst", "being caught puts humanity back to its checkpoint value". Tests never reach into private fields or check how many times a function was called.
- **Every number in a test comes from a test tuning table** written in the test, not from the game's tuning, so retuning the game never breaks tests.
- **Test runner:** GUT (Godot Unit Test), pinned as an addon inside the project, run headless with one command from the README. Ticket 01 confirms the GUT version works with the pinned Godot version.
- **Not tested automatically:** how scary it is, the look, the sound mix. Those are tested by playing. Each ticket that changes feel says in its PR what to try.
- **Prior art:** `pawn-swarm` keeps its rules in pure modules with no DOM and tests them with Vitest. Same idea here, with GDScript classes that don't depend on the scene tree, tested with GUT.

## Out of Scope

- Upstairs, basement, the lab story, clues (notes, tapes, photos), Dad and the other family members.
- **Smell trails.** They are part of the full game's senses, but not needed to test the core trade-off.
- Speech and its decay, talking to family members.
- Family members visibly changing at low humanity.
- The full endings, including the cannibal ending.
- Fake threats, fake smell trails, the rot turning real, Mum's voice from empty rooms (the other hallucinations). The first playable has slop/snacks, the mirror, pig vision, breathing and the rot (as a hallucination) only.
- "Hard body" mode with separate leg keys.
- Saving and loading a night, settings beyond sensitivity and volume, key rebinding.
- Gamepad, mobile, Safari, Steam build and achievements.
- Any AI or network service at runtime. The game is fully offline once loaded.

## Further Notes

### The full game (later specs under `docs/specs/`)

- **One continuous night, about 45–60 minutes, moving down through the house:** bedroom → upstairs → kitchen → basement → back door.
- **Story:** Dad worked at a lab and brought something home. The Piggy changed first. The rest of the family is changing more slowly and hunts the Piggy to hide what's coming for them. Told only through things found in the house, mostly in the basement. No cutscenes.
- **Family:** hunts from the start. At low humanity the Piggy glimpses that they are changing too (grosser models of the same people).
- **Hallucinations, ramping with humanity:**
  - At high humanity: Mum's voice from empty rooms.
  - **The rot turns real.** It is what Dad brought home, spreading through the house. Below a humanity threshold the Piggy finds out they weren't imagining it: from then on it can spread in plain view and Mum treats it as real. It never makes floors noisy or slow.
  - At low humanity: fake threats and fake smell trails.
  - Throughout: food lies. Slop looks like snacks, and at the bottom, people look like steak.
- **Speech:** a few words through doors at high humanity, fading to squeals.
- **Endings (2–3, by humanity):**
  - escape as yourself;
  - give in completely;
  - the worst: eating a family member, shown by implication (sound, cut to black, aftermath), never on screen.
- **Hard body mode:** separate keys for the legs, Endoparasitic-style.
- **Steam:** desktop export of the same project when the full game is ready.

### Open items to settle before or during tickets

- Whether the title screen needs an age gate on top of the content note (not discussed; the content note is in this spec).
- The exact Godot, GUT and gdtoolkit versions (ticket 01).
- Whether the nginx container serves `.wasm` files with the right content type (`application/wasm`). Godot's web build needs it. Check it once on the server during the deploy ticket, like the nginx check in `pawn-swarm`.
