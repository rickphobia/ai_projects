# Art pass: a game that looks like a game

## Problem Statement

Against All TOD plays well but looks like a prototype. The Board is flat neon-green grass with hard grid lines and a plain dirt strip. Every Dude kind is the same tiny grey soldier on an orange disc, so a Ram Crew and an Intern can't be told apart, and 500 of them read as orange confetti. Pieces are small grey turrets that look alike, and Crate Walls look like floor tiles rather than walls. Shots are thin lines, hits and deaths are hard to see, and the HUD is a line of small text with small buttons and panels that look like debug tools. There is no title screen and no moment that says "your turn". The spec's "Look" section promised a polish pass; this is it.

## Solution

Everything on the Board is drawn in code with PixiJS shapes (decision 0005), in two matching styles:

- **The Board and Pieces** are bright, clean and cartoon, in the style of Bloons TD 6: soft two-tone grass, a thick border with trees outside it, chunky Pieces with shadows, each with its own silhouette.
- **The Dudes** are wobbly blobs with faces, in the style of Totally Accurate Battle Simulator: they waddle as they walk, look panicked when hit, and flop over when they die. Every kind has its own silhouette.

The UI becomes a chunky cartoon game UI to match: thick rounded buttons that press in, icon chips for Lives, gold and Score, Dude portraits in the unit bar, cards for the crate, report, end screen, Settings and Pause, and a bundled rounded font. Effects get a projectile per tower, star puffs and bonks on hits, and gold coins that pop up. A title screen, turn banners and win/lose banners give the game its moments. The side colours keep their meaning: blue is the defense, orange-red the attack, and nothing else.

## User Stories

### The Board

1. As a player, I want the grass drawn in two soft shades in a gentle checker instead of hard grid lines, so that the Board looks like a place and not graph paper.
2. As a defender, I want to still see where one tile ends and the next begins, so that I can place Pieces precisely.
3. As a player, I want a few flowers and grass tufts scattered on the grass in a seeded pattern, so that the Board has life without changing between reloads.
4. As a player, I want a thick cartoon border around the Board with trees and bushes outside it, so that the Board has an edge and a world around it.
5. As an attacker, I want the Spawn zone drawn as a striped orange-red carpet, so that I can see where I can paint at a glance.
6. As a defender, I want the route drawn as a dashed path while I build, so that I can read the Dudes' way through my Maze.
7. As a player, I want the Goal drawn as a little office building with its health bar, so that it reads as the thing being attacked.
8. As a defender, I want Crate Walls drawn as chunky stacked wooden crates with a shadow, so that they read as walls, not floor.
9. As a player, I want the extra lanes that Window size opens drawn in the same style, so that the trick never breaks the look.
10. As a player, I want the Board in the dark (Brightness down) to dim all of this while lit tiles stay bright, so that the trick still works as before.

### Dudes

11. As a player, I want every Dude drawn as a round blob body in the attack colour with two dot eyes, so that the Army looks like characters, not icons.
12. As a player, I want Dudes to waddle as they walk, so that a charge looks alive.
13. As a player, I want a Dude to look panicked for a moment when hit, so that I can see my towers landing shots.
14. As a player, I want a dying Dude to flop over and fade, so that deaths are easy to see and funny.
15. As a player, I want each Dude kind to have its own silhouette, so that I can tell the kinds apart without colour:
    - Intern: small, with a tie
    - Termite: a bug body with antennae
    - Ram Crew: a log carried by four heads
    - Balloonist: hanging under a balloon
    - Shield Bro: a big shield in front
    - Hype Man: a megaphone
    - Sapper: a bomb on his back
    - Mole: a dirt mound with a head
    - Streaker: bare, with motion lines
    - The Landlord: big, with a top hat and a cane
16. As a player on a phone, I want every kind readable at fit-to-window zoom, so that I can play on a small screen.
17. As a player, I want 500 Interns to still run at 60 fps on a laptop and at least 30 fps on a mid-range phone, so that the new look costs no smoothness.
18. As a player, I want Mutations shown as a small mark or outline on the Dude (Giant bigger, Split halves smaller, Ghost Mode see-through, Gold Teeth a gold grin, Explosive Shields a fuse, Conga Line hands on shoulders), so that I can see what each Dude carries without a new colour.
19. As a player in the dark, I want Dudes to keep a glowing outline in the attack colour, so that they stay visible.
20. As an attacker holding the eraser, I want older Dudes dimmed as now, so that I still know which ones refund.

### Pieces

21. As a defender, I want every Piece drawn in code with its working part in the defense colour and its own silhouette:
    - Sniper Nest: a sandbag ring with a long barrel that turns to aim
    - Turnstile: a metal gate with arms that turn
    - Lighthouse: a white and red tower with a sweeping light cone
    - Siren: a pole with a loudspeaker horn and rings pulsing out
    - Tax Booth: a little ticket booth with a barrier arm
    - Grinder: a floor plate with spinning teeth
    - Bouncer: a big guy in shades with crossed arms
    - Decoy Goal: a cardboard copy of the Goal office, slightly crooked
    - The HR Department: a grey office desk with an "HR" sign and a stern face behind it
    so that I recognise each Piece without reading its name.
22. As a defender, I want floor traps drawn flat and towers and walls drawn standing with a shadow, so that I can tell what Dudes walk over from what blocks them.
23. As a defender, I want the placement cursor and refused tiles drawn in the new style, so that building feels part of the same game.

### Effects

24. As a defender, I want each tower to fire its own projectile (a bullet from the Sniper Nest, a light beam from the Lighthouse, sound rings from the Siren), so that I can see which tower is working.
25. As a player, I want a small star puff where a shot lands, so that hits are visible.
26. As an attacker, I want a "bonk" burst when a Wall-breaker hits a wall, so that I can see my Army breaking through.
27. As a player, I want "+Xg" coins to pop up where gold is earned, so that I see my wallets grow.
28. As a player, I want ordinary effects to last about a fifth of a second, so that 500 Dudes stay readable.
29. As a player, I want the Goal to collapse into rubble with a screen shake when it breaks, so that the big moment feels big.
30. As a player, I want bosses arriving and dying to shake the screen, so that Boss Rounds feel special.
31. As a player, I want no screen shake for ordinary hits, so that the screen never gets tiring.

### The UI

32. As a player, I want thick rounded buttons with a bottom shadow that press in when tapped, so that the UI feels like a game.
33. As a player, I want the top bar as icon chips (❤ Lives, 🛡 Defense gold, ⚔ Attack gold, ★ Score, Round), so that I read my state in a glance instead of a sentence.
34. As a player, I want the current side's colour on the active choice, so that I always know whose turn it is.
35. As an attacker, I want each kind in the unit bar to show its Dude's portrait above its price, so that I pick a brush by its look.
36. As a defender, I want the Piece shop to show each Piece's drawing above its price, so that I pick by look too.
37. As a player, I want the Draft Crate, the Round report and the end screen as cards with a title ribbon, so that they look like part of the game.
38. As a player, I want the Settings menu as a card where each trick (Brightness, Game speed, Volume, Window size) has a drawn icon (a sun, a turtle and a rabbit, a speaker, a window), so that I find a trick by its picture.
39. As a player, I want each trick's slider track to fill blue toward the side that helps the defense and orange-red toward the side that helps the attack, so that I see who a trick favours without reading.
40. As a player, I want a trick's price as a coin chip on its slider handle, so that I see what a move costs before I make it.
41. As a player, I want Undo as a separate red button with a skull icon, so that it can't be confused with Take back and looks as painful as it is.
42. As a player, I want the Pause menu as the same kind of card, so that menus look alike.
43. As a player, I want the Take back and Fight buttons in the new style, so that the two most-pressed buttons look the best.
44. As a phone player, I want every button at least 44 px tall, so that I can tap it reliably.
45. As a player, I want headings and buttons in a rounded display font that's part of the game, so that it looks the same everywhere and works offline and on itch.io.

### Moments

46. As a player, I want a title screen with the game's logo, my best Score and a big Play button, so that the game has a front door.
47. As a returning player, I want Play to continue my saved Run, with a smaller "New Run" beside it, so that the title screen never throws a Run away.
48. As a player opening a seeded link, I want to skip the title screen, so that shared seeds and tests go straight in.
49. As a player, I want a ribbon banner sliding in at each turn ("DEFENSE TURN!" in blue, "ATTACK TURN!" in orange-red), so that the side switch is impossible to miss.
50. As a player, I want a win or lose banner when a battle ends, so that I know the result before the report opens.
51. As a player, I want a short soft transition between screens, so that the game never jumps.
52. As a player, I want banners and transitions short (under a second) and skippable with a tap, so that they never slow down a Run.

### Rules kept

53. As a player, I want blue to mean defense and orange-red to mean attack everywhere, and to be used for nothing else, so that a glance at the Board still tells who owns what.
54. As a player, I want every Settings trick to still show its state on the Board, so that the art pass never hides a trick.

## Implementation Decisions

- **Drawing in code (decision 0005).** A new renderer module, the **art kit**, draws every shape with PixiJS `Graphics` and bakes each one into a texture once at start-up (`renderer.generateTexture`, as the Dude disc already is). Views keep using pooled `Sprite`s from those textures, so batching and the 500-Dude budget hold. Shapes that animate (waddle, flop, turning barrels, sweeping light) animate by sprite transforms (position, rotation, scale, alpha) over a few baked frames at most, never by redrawing `Graphics` each frame.
- **One texture set.** `BoardTextures` grows into the art kit's texture set, built once and passed to the views as today. The Kenney tile imports leave the renderer ticket by ticket; the last art ticket that uses them deletes `assets/kenney-tower-defense-top-down/` and its README credit. The Kenney sounds stay.
- **Seeded decoration.** Flowers, tufts and trees are placed from the Run's seed, so they never jump between reloads or Rewinds and never cover a tile's content.
- **Palette.** The side colours, refused red, background and text colours stay. The art kit adds its own named colours (grass light and dark, border, wood, office, skin, outline, shadow), defined next to the existing ones in the renderer and as CSS variables in the page, kept matching, never written inline.
- **Outlines and shadows.** Every drawn thing has a dark rounded outline and a soft drop shadow under it, the same thickness at every size, so the styles match.
- **Dude animation is cosmetic.** Waddle phase comes from the Dude's index and the battle step, not from randomness, so a replay looks the same. Flop-and-fade plays after a Dude is removed from the battle state and never feeds back into it.
- **Effects** reuse pooled sprites and shared textures. Each tower kind names its projectile in the renderer, not in the catalog. Screen shake is a camera offset that decays in under half a second and only fires for the Goal breaking, a boss arriving and a boss dying.
- **UI.** DOM overlays stay DOM. The page's stylesheet gains a small set of shared component styles (chunky button, chip, card, ribbon, slider) used by every overlay. Portraits and icons in the DOM are PNG data URLs extracted from the art kit's textures at start-up, so the UI and the Board show the same drawings. The display font (Fredoka, OFL licence) is bundled in the project's assets with its licence and credited in the README; body text keeps the system font.
- **Debug panel.** Keeps its URL option and its plain look; it is a developer tool, not part of the game.
- **Title screen and banners.** A title screen module shows before the Run screen unless the URL carries a seed or the debug swarm screen is asked for. Banners are DOM overlays driven by the Run screen at turn change and battle end; a tap skips them.
- **Spec "Look" section.** Each art ticket rewrites the rule it changes in `docs/spec.md` ("One art pack", "Dudes", "Pieces", "Effects", "UI") in the same commit, so the spec always says what the game does.

## Testing Decisions

- The renderer, DOM UI, banners and title screen are checked by running the game, as the spec's testing decisions already say. Every art ticket's PR includes before and after screenshots of the same scene, at desktop and phone size, and adds or updates the matching file in `docs/screenshots/`.
- **Performance:** every ticket that changes how Dudes or effects are drawn runs the debug swarm screen (500 Interns charging) and reports the fps in the PR. It must stay at 60 fps on the Beelink's browser and inside the existing benchmark's budget.
- **Unit tests** where there is logic: the art kit builds a texture for every Dude kind and every Piece in the catalog (so a new kind can't ship without a drawing); seeded decoration is the same for the same seed and never lands on a Piece; the title screen's Play continues a saved Run and New Run starts one; banners skip on tap. Prior art: the existing renderer helper tests (`fit-to-view`, `camera`) and the UI tests (shop, settings).
- **Dark mode** is checked by a screenshot with Brightness down in each Board, Dude and Piece ticket.

## Out of Scope

- New sounds or music; the Kenney sounds stay.
- Changing any rule, price, balance number or battle result. The art pass only draws.
- Skeletal or physics ragdoll animation; Dudes wobble with simple transforms.
- Pixel art, isometric or 3D views.
- Curse-specific Board effects beyond what the game already shows.
- Take back itself (`docs/specs/take-back.md`); the art pass only restyles its button.

## Further Notes

- Agreed in the art-pass grilling, ranked by what looks worst: Board, Dudes, UI, Pieces, effects, overall feel. The tickets follow that order.
- Decision 0005 records why the art is drawn in code and the Kenney tiles leave.
- The Bloons TD 6 and Totally Accurate Battle Simulator references are for style only; nothing is copied from either.
