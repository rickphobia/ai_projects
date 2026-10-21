# Against All TOD: browser demo spec

## Problem Statement

The owner has a game idea, a Tower Offense Defense mashup where you build a fortress, then switch sides and try to break it, on a board that never resets. Before spending months on a Steam game, they need to know whether it is fun. The demo has to answer that question cheaply: something friends can open from a link on a laptop or phone, play for a few Runs, and either come back to without being asked or not.

The pitch as first written had holes that would make people quit: no way to lose, no pressure from outside the player, the same pay for every win, and gimmicks that punish the player as much as the opponent. The demo must close those holes, or the test only proves that a broken design is broken.

## Solution

A solo browser game, **Against All TOD**, played on a 22×14 tile Board seen from above.

A Run starts on an empty Board. Round 1 is a Defense turn against a small game-made Army. Every Round the player wins, they switch sides: build the Maze on a Defense turn, paint Dudes into the Army on an Attack turn, and each time try to beat what they built one Round ago. Nothing on the Board ever despawns, so by Round 15 the Maze and the Army are the history of every choice made.

Each Round opens a Draft Crate for the side being played (pick 1 of 3 for free), announces a random Curse, and lets the player spend that side's own gold. Gold pays for the margin of victory, not for just winning. The player can also open the game's own Settings menu and drag Brightness, Volume, Window size or Game speed to bend the battle. Each slider pulls both ways, every drag costs gold, and a trick stays until someone Undoes it by destroying their own Pieces or Dudes.

The player has 3 Lives. A lost Round costs a Life and Rewinds the Round with bonus gold. At zero Lives the Run ends, the Score (Rounds won) is compared to the best Score, and Score milestones Unlock new Pieces and Dude kinds for later Runs.

It runs in any modern desktop browser and on phones and tablets in landscape, saves everything in the browser, and needs no server.

## User Stories

### Starting and the Run

1. As a new player, I want to click a link and be playing within seconds, so that I don't leave while it loads.
2. As a new player, I want a one-line hint in Round 1 telling me to place walls so Dudes walk past my towers, so that I understand mazing without a tutorial.
3. As a new player, I want a one-line hint in Round 2 explaining that I now attack my own Maze, so that the side switch doesn't confuse me.
4. As a new player, I want a one-line hint in Round 3 pointing at the Settings menu, so that I discover Settings tricks.
5. As a returning player, I want the hints to stop after my first Run, so that they don't nag me.
6. As a player, I want Round 1 to be a Defense turn against a small game-made Army, so that I start by building.
7. As a player, I want to switch sides only after I win a Round, so that I can't sandbag one side.
8. As a player, I want to start a Run with 3 Lives, so that mistakes are allowed but limited.
9. As a player, I want a lost Round to cost one Life, so that losing has weight.
10. As a player, I want a lost Round to Rewind the Board to how it was when that Round started, so that I can try a different plan instead of living with a bad placement.
11. As a player, I want the same crate pick and gold after a Rewind, plus some bonus gold, so that I'm not stuck losing the same way three times.
12. As a player, I want the Run to end when my Lives reach zero, so that each Run has stakes.
13. As a player, I want my Score to be the number of Rounds I've won, so that I have a clear number to beat.
14. As a player, I want to see my best Score at the start and end of every Run, so that I always know what I'm chasing.
15. As a player, I want a Run to have no last Round, so that a great Run can keep going.
16. As a player, I want to see the current Round, my side, my Lives and both wallets at all times, so that I know where I stand.
17. As a player, I want to pause at any time, so that I can step away.
18. As a player, I want to start a new Run from the end screen in one click, so that "one more Run" is easy.

### The Board and the Maze

19. As a defender, I want an empty 22×14 tile Board at the start of a Run, so that the Maze is entirely mine.
20. As a defender, I want every Piece to snap to tiles, so that the Maze is tidy and easy to read.
21. As a defender, I want Dudes to walk the shortest open route from the Spawn zone to the Goal, so that placing Pieces shapes their path.
22. As a defender, I want a placement that would seal the Goal off to be refused with a clear message, so that I know why it failed.
23. As a defender, I want to see the route Dudes will take before the battle, so that I can plan my Maze.
24. As a defender, I want floor Pieces (Tax Booth, Grinder) to be walkable, so that I can put them on the route.
25. As a defender, I want no way to sell or move a placed Piece, so that the permanent Board means something.
26. As an attacker, I want to paint single Dudes anywhere in the Spawn zone by dragging, so that I choose where and in what shape the Army stands (see `specs/spawn-zone.md`).
27. As an attacker, I want every Dude I have ever placed to come back each Attack turn in the same place, so that my Army compounds.
28. As a player, I want the Goal to have a visible health bar, so that I can see how close a Round is.

### Draft Crates and the shop

29. As a player, I want a Draft Crate of 3 random items for the side I'm playing at the start of each Round, so that every Round offers something new.
30. As a player, I want to take 1 item from the crate for free, so that I always get something.
31. As a defender, I want defense crates to hold Pieces, so that the crate fits my turn.
32. As an attacker, I want attack crates to hold gifts of free Dudes and Mutations, so that the crate fits my turn.
33. As a player, I want to reroll the crate for gold, so that bad luck doesn't decide a Round.
34. As a player, I want a shop where I can buy more items for my side with that side's gold, so that I control my build beyond luck.
35. As a player, I want crates and the shop to offer only what I have Unlocked, so that Unlocks matter.
36. As a player, I want the crate after a Boss Round I won to offer 2 picks from 5, so that beating a boss feels big.
37. As a player, I want a boss crate to sometimes contain a free Undo, so that I have a rare way out of a trick.

### Gold

38. As a defender, I want Defense gold for every Dude I kill, so that carnage pays.
39. As a defender, I want a bonus for the Goal health left when I win, so that holding at 100% pays more than holding at 5%.
40. As an attacker, I want Attack gold for every Dude that reaches the Goal, so that getting through pays.
41. As an attacker, I want Attack gold for every Dude still alive when the Goal breaks, so that a crushing win pays more than a scrape.
42. As an attacker, I want Attack gold for every Piece my Wall-breakers destroy, so that breaking the Maze pays.
43. As an attacker, I want bigger Dude kinds to be worth more gold than small ones, so that a surviving Giant counts for more than a surviving Intern.
44. As a player, I want the two wallets kept apart, so that I can't starve one side to make the other easier.
45. As a player, I want the end-of-Round screen to show where my gold came from, so that I learn what earns.

### Defense Pieces

46. As a defender, I want a cheap Crate Wall, so that shaping the route doesn't cost a whole tower.
47. As a defender, I want a Turnstile that turns 90° every 5 seconds and flips the route, so that Dudes have to re-route mid-walk.
48. As a defender, I want a Lighthouse whose sweeping beam hurts Dudes, works in the dark and lights nearby tiles for other towers, so that I have an answer to a dark Board.
49. As a defender, I want a Siren that stuns Dudes in range every few seconds with a range that grows with Volume, so that Volume matters to me.
50. As a defender, I want a Sniper Nest with huge range that always shoots the biggest Dude and is blind in the dark, so that big Dudes have a counter.
51. As a defender, I want a Tax Booth that moves some Attack gold into Defense gold for every Dude that crosses it, so that I can drain the attacker.
52. As a defender, I want a Grinder that instantly kills small Dudes, pays double gold and jams for 3 seconds after each kill, so that swarms of Interns have a counter.
53. As a defender who has Unlocked it, I want a Bouncer that throws the first Dude it touches back to where it was painted, so that I can reset a runner.
54. As a defender who has Unlocked it, I want a Decoy Goal that Dudes go for first until it breaks, so that I can buy time.
55. As a defender, I want to tap or hover over any Piece to see what it does, so that I never have to guess.
56. As a defender, I want Lighthouse and Sniper Nest to be the only Pieces that hit Balloonists, so that air Dudes have clear counters.

### Dude kinds

57. As an attacker, I want Interns that cost 1 gold each and come 20 to a crate gift, so that I have cheap fodder.
58. As an attacker, I want Termites that slowly chew through a wall so the others re-route through the hole, so that I can open the Maze.
59. As an attacker, I want a Ram Crew of 4 carrying a ram that smashes a wall or tower in one hit and slows as carriers die, so that I can break the strongest Pieces.
60. As an attacker, I want Balloonists that float straight over the Maze, so that I can skip a long Maze.
61. As an attacker, I want a Shield Bro whose shield blocks shots for the Dudes behind him, so that I can protect the Dudes around him.
62. As an attacker, I want a Hype Man that speeds up nearby Dudes with a boost that grows with Volume, so that Volume matters to me too.
63. As an attacker who has Unlocked it, I want a Sapper that runs to the nearest wall and blows up himself and the wall, so that I can open a hole fast.
64. As an attacker who has Unlocked it, I want a Mole that tunnels under 3 tiles of Maze and pops up, so that I can skip a choke point.
65. As an attacker who has Unlocked it, I want a Streaker that every tower in range turns to shoot first, so that I can pull fire off my Army.
66. As a player, I want only Wall-breakers (and bosses) to damage Pieces, so that the Maze stays meaningful.

### Mutations

67. As an attacker, I want a Split Mutation where a Dude splits into two halves when it dies, so that my Army gets messier to kill.
68. As an attacker, I want a Giant Mutation that makes every Nth Dude of a kind giant (5× health, half speed; N per kind, 20 for Interns), so that the Army has tanks.
69. As an attacker, I want Explosive Shields, where every Dude's small shield stuns nearby towers for 1 second when it breaks, so that my Army fights back.
70. As an attacker, I want a Conga Line Mutation where each Stroke walks in single file and shares damage across the line, so that focused fire is wasted.
71. As an attacker, I want Ghost Mode where dead Dudes keep walking for 3 seconds and can't be shot, so that dying near the Goal still counts.
72. As an attacker, I want Gold Teeth so that Dudes reaching the Goal earn double Attack gold, so that I can build for income.
73. As a player, I want Mutations to stay for the rest of the Run and apply to every Dude, so that the Army compounds.

### Curses and bosses

74. As a player, I want a random Curse announced before I build each Round, so that I plan around pressure I didn't choose.
75. As a defender, I want Rust, Power Cut, Earthquake and Audit to be Curses that hurt the defense, so that my Maze is tested in new ways.
76. As an attacker, I want Traffic Jam, Mud, Stage Fright and Union Break to be Curses that hurt the attack, so that my Army is tested in new ways.
77. As a player, I want a Curse to last one Round only, so that bad luck doesn't snowball.
78. As a player, I want every fifth Round to be a Boss Round, so that there are peaks to aim for.
79. As a defender in a Boss Round, I want The Landlord to join the attacking Army with huge health, evicting a Piece every 10 tiles he walks, so that my Maze faces a real test.
80. As an attacker in a Boss Round, I want The HR Department to appear in the Maze and turn my Wall-breakers back the way they came, so that my Army faces a real test.
81. As a player, I want a boss to last for its Boss Round only, so that it doesn't wreck the permanent Board.

### Settings tricks and Undo

82. As a player, I want a Settings menu with Brightness, Volume, Window size and Game speed sliders that change the battle, so that I can weaponize the UI.
83. As a player, I want each slider to have a neutral middle, with one direction helping attack and the other helping defense, so that it's a tug of war.
84. As an attacker, I want Brightness down to shrink tower range and really darken the Board, so that I can blind the Snipers.
85. As a defender, I want Brightness up to dazzle Dudes and slow them, so that light helps me.
86. As an attacker, I want Volume down to make Dudes invisible until they are 2 tiles from a tower and really quiet the game, so that my Army sneaks in.
87. As a defender, I want Volume up to make Sirens reach further, so that noise helps me.
88. As an attacker, I want Window size up to add an open lane along the top and bottom edges, so that I get a route around the Maze.
89. As a defender, I want Window size down to squeeze the Spawn zone so Dudes bunch up, so that my splash damage feasts.
90. As an attacker, I want Game speed up to make Dudes move faster than towers can turn and aim, so that I can outrun the defense.
91. As a defender, I want Game speed down to give my towers extra shots, so that slow-mo helps me.
92. As a player, I want every slider drag to cost the current side's gold, so that tricks are a real spend.
93. As a player, I want to pull a trick mid-battle for double the price, so that I have something to do while the battle plays.
94. As a player, I want a trick to stay until it's Undone, so that every dirty trick comes back to bite me.
95. As a player, I want to Undo a trick by choosing which of my own Pieces or Dudes to destroy, up to the trick's price, so that getting out of a trick is a painful choice.
96. As a player, I want the dark and the silence to keep units readable with glowing outlines, so that a trick changes how the battle plays, not whether I can see it.
97. As a player who wants quiet, I want an "Actual volume (we promise)" slider in the pause menu, so that I can set real sound without touching the game's tricks.

### Watching the battle

98. As a player, I want to watch the battle at 1x, 2x or 4x without changing who wins, so that long battles don't bore me.
99. As a player, I want a battle to end when the Goal breaks, so that a win lands straight away.
100. As a player, I want a battle to end with a defense win after 90 seconds of game time, so that a stalled battle can't go on forever.
101. As a player, I want one clear color per side and bold Dude shapes, so that hundreds of units stay readable.
102. As a player, I want a Round report after every battle showing Goal damage, kills per Piece, where Dudes died and gold earned, so that I know why I won or lost.

### Unlocks

103. As a player, I want to Unlock new Pieces and Dude kinds by reaching Score milestones, so that a lost Run still gives me something.
104. As a player, I want Unlocks to stay between Runs, so that progress builds up.
105. As a player, I want to see the next Unlock and the Score it needs, so that I have a goal for the next Run.

### Devices and saving

106. As a desktop player, I want to place with the mouse, zoom with the wheel and pan by dragging, so that the controls feel normal.
107. As a phone or tablet player, I want to tap to place, pinch to zoom and drag to pan in landscape, so that I can play from a link in a group chat.
108. As a phone player holding the device upright, I want a "turn your device" screen, so that I know to rotate.
109. As a player, I want the current Run, best Score, Unlocks and actual volume saved in my browser, so that a refresh or closed tab loses nothing.
110. As a player who refreshes mid-battle, I want that battle to restart from its beginning, so that I'm never stuck in a broken half-battle.
111. As a player whose save can't be read, I want a fresh start with a short message instead of a crash, so that the game still works.
112. As a player on a mid-range phone, I want hundreds of Dudes to stay smooth, so that the swarm is fun, not a slideshow.

### Owner and maintainer

113. As the owner, I want the demo at `rickphobia.com/ai-projects/against-all-tod/` and as an itch.io web build from the same files, so that friends and strangers can play it.
114. As the owner, I want every PR to carry a `▶ Try this version` link, so that I can play a change before merging.
115. As the owner, I want every number (prices, health, ranges, milestones) in one tuning catalog, so that balancing doesn't mean hunting through code.
116. As a developer, I want a seed in the URL to reproduce a Run exactly, so that bug reports can be replayed.
117. As a developer, I want debug options (give gold, jump to Round N, show the route) behind a URL flag, so that I can test late-game states without playing 20 Rounds.
118. As a developer, I want structured logs of Round results and errors in the browser console, so that I can debug a friend's report from their console output.
119. As a developer, I want a clear error screen if the game fails to start, so that a broken build is obvious.

## Implementation Decisions

Engine and tools follow decision 0001: TypeScript (strict), Vite, PixiJS for rendering. Rules live in pure modules with no DOM or PixiJS so they can be tested headless and, later, reused for a Steam build or networked play.

### Modules

- **config**: reads build-time settings (base path for the site, debug flag, default seed handling) and validates them at startup.
- **rng**: seeded random numbers. Every random roll (crates, Curses, Split halves) goes through it, so a seed reproduces a Run.
- **catalog**: the data for every Piece, Dude kind, Mutation, Curse, boss, Settings trick, Unlock milestone and gold rule, with all tuning numbers. Pure data plus small lookups. Item ids are stable strings so saves and tests refer to them by name.
- **maze**: the tile grid, Piece placement, the shortest-route calculation from the Goal over walkable tiles, the "never sealed" check, and the route preview. It answers "is this placement legal?" and "which way does a Dude on this tile walk?". The route is a per-tile direction field so hundreds of Dudes share one calculation. Wall-breakers use a second field where blocking Pieces are passable at a high cost, so they head for the wall that matters.
- **battle**: a real-time battle stepped at a fixed 1/60 s, as a pure function of (Board, Army, Mutations, slider positions, Curse, boss, seed, mid-battle inputs). It moves Dudes, runs tower targeting and damage, Wall-breaker damage to Pieces, Turnstile turns, Mole tunnelling, Balloonist flight, Mutation effects, slider effects and Curse effects, and emits events (kill, reach Goal, Piece destroyed, gold moved by Tax Booth). It ends on Goal at zero (attack win), no Dudes left (defense win) or 90 s of game time (defense win). The same inputs always give the same result.
- **economy**: turns a battle's events and end state into Defense gold and Attack gold: per kill, Goal health bonus, per Dude reaching the Goal, per survivor at Goal break, per Piece destroyed, Tax Booth transfers, Gold Teeth doubling, Grinder doubling, Rewind bonus.
- **tricks**: slider positions, the price of each drag (doubled mid-battle), and the Undo price. It knows which direction helps which side.
- **run**: the whole Run as a state machine driven by actions (pick from crate, reroll, buy, place Piece, paint Dude, erase Dude, dismiss Dude, drag slider, Undo, start battle, battle finished, continue). It owns Lives, Rewind snapshots, side switching, Round numbering, Curse rolls, Boss Rounds, boss crates, Score, hints shown and the end of the Run. It refuses illegal actions with a typed reason (not enough gold, would seal the Goal, wrong side, tile taken).
- **progress**: best Score and Unlocks across Runs, and which Unlocks a Score earns.
- **adapters/storage**: saves and loads the Run, progress and actual volume to browser storage, with a version number. Unknown versions or broken data give a fresh start plus a warning instead of a crash.
- **adapters/renderer**: draws the Board, Pieces, Dudes, effects, darkness with outlines, the route preview and the zoom/pan camera with PixiJS, using batched sprites from the Kenney packs. It reads state; it never changes rules.
- **adapters/audio**: plays Kenney sounds. Final level = actual volume × the Volume trick's level, so the trick really quiets the game while the pause-menu slider stays honest.
- **adapters/input**: turns mouse, wheel, touch, tap and pinch into board coordinates and actions.
- **ui**: DOM overlays for the HUD, Draft Crate, shop, Settings menu, pause menu, hints, Round report, end-of-Run screen, piece info and the turn-your-device screen.
- **logger**: a small levelled logger; logs Round start and end, results, gold earned, refused actions and errors, never full save contents.
- **main**: wires it together and shows a startup error screen if anything fails.

### Rules settled in the grilling

- The Board is 22 columns × 14 rows. The Spawn zone is the left 3 columns, where nothing can be built; the Maze has the other 19. The Goal sits on the right edge, and Dudes travel left to right.
- Pieces that block: Crate Wall, Turnstile, Lighthouse, Siren, Sniper Nest, Bouncer, Decoy Goal. Walkable floor Pieces: Tax Booth, Grinder. A Turnstile placement is legal only if the Goal stays reachable in both of its positions.
- The Army is single Dudes, each standing where it was painted in the Spawn zone, and the whole Army charges at once when a battle starts. A Dude painted this Round can be Erased for its price back; an older one can only be Dismissed (no refund), paid away in an Undo, or moved by Window size squeezing. Painting rules are in `specs/spawn-zone.md`.
- The Run alternates sides after each won Round: odd Rounds are Defense turns, even Rounds are Attack turns. Round N = Rounds won + 1. A Rewind keeps the Round number.
- On a Defense turn the whole Army (plus the boss on a Boss Round) attacks the Maze. On an Attack turn the player adds to the Army and attacks the Maze as it stands (plus the boss tower on a Boss Round).
- Curses start from Round 2, one per Round, picked at random from all 8, each hurting one side.
- Boss Rounds are Rounds 5, 10, 15 and so on. Defense-turn bosses: The Landlord. Attack-turn bosses: The HR Department. The boss is removed after the Round.
- Pieces have health, but only Wall-breakers and The Landlord reduce it.
- Small Dude kinds (killed instantly by the Grinder): Intern, Termite, Streaker. Others take heavy damage instead.
- Dudes that reach the Decoy Goal hit it and vanish but earn no Attack gold.
- Ghost Mode Dudes that reach the Goal still damage it and still pay.
- Each slider has a neutral middle and 2 steps each way. Brightness down, Volume down, Window size up and Game speed up help attack; the opposite directions help defense. Whichever side is being played pays for a drag from its own wallet.
- Moving a slider back toward the middle costs twice the normal step price, so tricks are sticky and Undo stays worth having.
- Undo resets one slider to the middle. The side being played pays by destroying its own Pieces or Dudes of its choice worth at least the Undo price. A free Undo from a boss crate skips the payment.
- Window size up adds an empty lane along the top and bottom edges. Window size down closes Spawn zone rows from both ends, pushing the Dudes in them into the nearest open row. When a lane closes again, any Piece placed on it is crushed. Window size is dragged only between battles, since it reshapes the Board and moves painted Dudes, and a drag that would cut the Spawn zone off from the Goal is refused, like a placement that seals it.
- Watch speed changes how many fixed steps run per real second, never the result. The Game speed trick changes Dude speed against tower turn and fire rate.
- Mid-battle tricks are recorded as timed inputs, so a battle with them is still reproducible from its seed.
- Unlock order by best Score milestone: Sapper (5), Bouncer (10), Mole (15), Decoy Goal (20), Streaker (25). Numbers live in the catalog and will be tuned.
- Hints show in Rounds 1–3 of a player's first Run only.
- Saving happens after every Run action and at "ready to fight". A reload during a battle restarts that battle from its start.
- Phones and tablets play in landscape. Portrait shows the turn-your-device screen. Nothing depends on hover.
- Performance target: 500 Dudes at 60 fps on a mid-range laptop and at least 30 fps on a mid-range phone from the last three years.

### Look

Every ticket that draws something new follows these rules, so the game looks like one game before any polish pass. Tickets 01–09 set this look; `docs/screenshots/03-defense-turn-battle.png` shows it.

The art pass (`docs/specs/art-pass.md`, decision 0005) replaces these rules one ticket at a time: everything on the Board becomes drawn in code, and each art ticket rewrites the rule it changes here.

- **One art pack.** Sprites come from Kenney's Tower Defense (top-down) pack: flat, top-down, 64 px tiles, soft outlines. When it has nothing that fits, use another Kenney CC0 pack in the same flat top-down style, never pixel art, isometric or 3D-rendered sprites. Copy only the tiles used into `assets/<pack>/` with its licence, and add the pack to the README credits.
- **Palette.** Background `#16201a`, text `#e8efe9`, muted text `#9fb3a5`, defense `#3d8bfd`, attack `#ff5a36`, refused `#ff3030`. The Board itself keeps the pack's own grass, dirt and stone colours. A new colour is added next to these (the CSS variables in `index.html` and the constants in `adapters/renderer/board-view.ts`, kept matching), never written inline.
- **Side colours mean side.** Anything that belongs to the defense is marked in the defense colour (turrets, tracers, the Goal frame); anything that belongs to the attack in the attack colour (Dude discs, the Spawn zone stripe). Blue and orange-red are used for nothing else, so a glance at the Board tells who owns what.
- **Dudes.** Every Dude stands on a disc in the attack colour with a light rim. Dude kinds differ by sprite shape and disc size (small kinds smaller, big kinds bigger), not by colour. A Dude must stay readable on a phone at fit-to-window zoom. Mutations add a small mark or outline, not a new colour.
- **Pieces.** A Piece is a Kenney base tile with its own top sprite, tinted in the defense colour where it has a working part. Each Piece kind has its own silhouette, so it is recognised without reading its name.
- **Effects.** Short and flat: tracers, hit flashes and death puffs last about a fifth of a second. No screen shake or full-screen flashes for ordinary hits; save those for the Goal breaking and boss moments. Effects reuse shared textures and pooled sprites, so 500 Dudes still run at 60 fps.
- **Tricks.** In the dark (Brightness down) units keep a glowing outline in their side colour. Every trick shows its state on the Board, not only in the Settings menu.
- **UI.** A chunky cartoon game UI. DOM overlays build from the page stylesheet's shared styles: `.btn` (a thick rounded button with a dark outline and a bottom shadow that presses in when tapped), `.chip` (a rounded pill with an icon and a short value) and `.card` (a rounded panel with a drop shadow), using only CSS variables (the palette above plus the UI kit's `--outline`, `--shadow`, `--surface` and `--gold`), never colours written inline. Headings and buttons use the bundled Fredoka display font (`assets/fonts/fredoka/`, OFL), body text the system font, and no font is fetched from outside. The top bar is icon chips (❤ Lives, 🛡 Defense gold, ⚔ Attack gold, ★ Score, Round, then the Curse and boss), each with its full words for screen readers, beside the turn in the side's colour. The current side's colour marks the turn and the active choice. Every button is at least 44 px tall on touch devices. Nothing depends on hover.

### Delivery

- Built as static files, deployed by `deploy/update-site.sh` like pawn-swarm, and zipped for itch.io from the same build.
- Added to `scripts/try-pr.sh` so the Beelink serves PR previews, and each PR also gets an Artifact preview while the build fits.
- CI workflow `against-all-tod` runs lint, format check, type check, tests and build.

## Testing Decisions

- A good test drives a module through its public interface and checks what the player would see: a refused placement, a gold total, a winner, a Dude's position. It never checks private fields or call order. Tests refer to catalog items by id and read tuning numbers from the catalog, so retuning doesn't break tests.
- **Two main seams**, both pure:
  - **run**: scripted action lists from a seed, checking the resulting state. Covers side switching, Lives, Rewind with bonus gold, crate picks and rerolls, shop spending, wallet separation, refused actions with their reasons, Boss Round timing and boss crates, Curse rolls, slider prices including double mid-battle and double toward the middle, Undo payment, Score, end of Run and hints only in Rounds 1–3 of the first Run. Battles inside a run test are resolved by the real battle module.
  - **battle**: small hand-built Boards and Armies, stepped to the end or for a set time. One test file per group: Pieces, Dude kinds, Mutations, Curses, bosses, slider effects. Each item does what its description says. Plus: end conditions (Goal break, all Dudes gone, 90 s), Watch speed never changes the result, and the same seed and inputs always give the same result.
- **maze**: shortest route, refused sealing placements (including a Turnstile in either position), the Wall-breaker route heading for the right wall, and route updates after a wall breaks.
- **economy**: each gold rule with a hand-made event list.
- **progress** and **adapters/storage**: Unlocks earned by Score; save and load round-trip through a fake storage; broken and old-version data give a fresh start.
- **Balance smoke test**: a few seeded scripted Runs with simple fixed strategies play to Round 10 headless, to catch a change that makes one side unbeatable. It checks bounds (e.g. a basic Army can break a basic Maze within N Rounds), not exact numbers.
- Renderer, audio, input and DOM UI are checked by running the game; each UI ticket's PR includes a screenshot, and touch tickets are tried on a real phone.
- Prior art: `projects/pawn-swarm/tests/battle/` (fixed-step battle tests per unit type), `tests/run/run.test.ts` (scripted runs), `tests/balance/balance.test.ts` (headless balance checks).

## Out of Scope

- 1v1 friend mode, local or online.
- Fighting other players' saved Mazes or Armies.
- Online leaderboards, accounts or any server.
- Play tracking or analytics.
- Steam build, Steamworks, achievements and controller support.
- Portrait layout on phones.
- Custom art, music and a real sound designer; the demo uses Kenney packs.
- Selling or moving placed Pieces.
- More content than listed: 9 Pieces, 9 Dude kinds, 6 Mutations, 8 Curses, 2 bosses, 4 sliders, 5 Unlocks.
- Translations; the demo is English only.

## Further Notes

- **Rules I filled in while writing this spec**, beyond what the grilling settled explicitly: the double price for moving a slider back toward the middle (otherwise buying the opposite step is a cheap Undo and the tug of war has no teeth); Window size as edge lanes rather than a column, moved only between battles, and refused when it would seal the Goal (decision 0003); Ghost Mode Dudes still paying; Decoy Goal paying nothing; which Dude kinds count as small; the Unlock order; 2 steps each way per slider; a Sniper Nest choosing between equally big Dudes shoots the one closest to the Goal, then the one that entered first. Each is a single catalog value or rule, cheap to change.
- **Success test for the demo**: post it on rickphobia.com and itch.io, give it to 5 friends, and go to Steam if most play 3 or more Runs without being asked or itch players ask for more.
- **Steam path**: wrap the same build in Electron with a Steamworks binding. The pure, seeded battle is also what an online 1v1 or "fight other players' saved forts" mode would need later, since two machines can replay the same battle from the same inputs.
- Kenney packs are CC0. Record which packs are used in the README credits anyway.
- Balancing two compounding sides is the hardest part of this design. Expect tuning tickets after the first playable build, and lean on the balance smoke test and the seed-in-URL debug flag.
