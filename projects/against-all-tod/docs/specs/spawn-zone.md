# Spawn zone: paint single Dudes, charge at once

## Problem Statement

On an Attack turn the attacker buys Squads (20 Interns, 10 Termites…) and drops each one on a tile of a one-column Spawn line, and the Squad files onto the Board one Dude at a time. There is almost nothing to decide about *where* the Army stands: one row or another. The fun of a battle game like Totally Accurate Battle Simulator is placing every unit yourself and then watching the whole army charge, and Against All TOD has neither.

## Solution

The left 3 columns of the Board become the **Spawn zone** (the Board grows to 22 × 14, so the Maze keeps its 19 columns). Squads leave the game: on an Attack turn the attacker picks a Dude kind from a unit bar and **paints** single Dudes into the zone by dragging, paying each Dude's own price as it appears. Dudes keep a little room around them by size, so the zone fills up like a real crowd. Mistakes made this Round can be **Erased** for a refund; Dudes from earlier Rounds can be **Dismissed** to make room, for nothing back. When the battle starts, the **whole Army charges at once** from where it stands. Mutations, the Bouncer, crates and the later Window size and Undo tricks are re-cut for single Dudes. Decision 0002 records why.

## User Stories

### The zone

1. As a player, I want the Spawn zone to be the left 3 columns of the Board, so that the Army has room to take a shape.
2. As a defender, I want the Maze to keep 19 buildable columns, so that the wider zone doesn't shrink my Maze.
3. As a defender, I want building in the Spawn zone to be refused, so that the attacker's ground stays theirs.
4. As a player, I want the Spawn zone drawn in the attack colour, so that I can see at a glance where Dudes can go.
5. As a defender, I want Dudes to walk the shortest open route from wherever they stand in the zone, so that my Maze still shapes every path.

### Painting

6. As an attacker, I want a unit bar along the bottom of the screen listing every Dude kind I can field, with its price per Dude, so that I can choose a brush like in TABS.
7. As an attacker, I want to tap a Dude kind to make it my brush, so that painting puts down that kind.
8. As an attacker, I want a drag that starts inside the Spawn zone to paint Dudes along my finger or mouse, so that I can draw the Army's shape.
9. As an attacker, I want a drag that starts outside the zone to pan the camera as before, so that I never have to switch modes.
10. As a player on a phone, I want two fingers to always pan and zoom, so that painting never traps the camera.
11. As an attacker, I want a new Dude to appear only where it has room (by its size), so that a crowd forms instead of a pile.
12. As an attacker, I want holding still to add nothing, so that a pause mid-drag doesn't dump gold into one spot.
13. As an attacker, I want bigger Dude kinds to take more room (a Ram Crew the room of 4 Interns), so that space is a real cost.
14. As an attacker, I want a full Spawn zone to hold about 500 Interns, so that the battle stays smooth.
15. As an attacker, I want a drag that wanders out of the zone to keep painting only inside it, so that a sloppy stroke near the edge still works.
16. As an attacker, I want each Dude to cost its own price the moment it appears, so that I can see the gold go as I paint.
17. As an attacker, I want painting to stop putting down Dudes when I can't afford the next one, so that I can't go into debt.
18. As an attacker, I want whole-number prices per Dude (Intern 1, Termite 3, Ram Crew 60, Balloonist 7, Shield Bro 13, Hype Man 12, Sapper 15, Mole 4, Streaker 6), so that gold stays simple.
19. As an attacker, I want a short message when painting is refused (no room, not enough gold), so that I know why nothing appeared.
20. As an attacker, I want painting to work only in the building phase of an Attack turn, so that the rules stay clear.

### Erase and Dismiss

21. As an attacker, I want an eraser on the unit bar, so that I can fix a bad stroke.
22. As an attacker, I want to Erase a Dude I painted this Round for its full price back, so that a slip costs nothing.
23. As an attacker, I want to Dismiss a Dude from an earlier Round with the same eraser, for no refund, so that I can make room for better Dudes.
24. As an attacker, I want to see which Dudes are this Round's and which are older while erasing, so that I know which ones refund.
25. As an attacker, I want Erase and Dismiss to work by dragging the eraser over Dudes, so that clearing an area is quick.
26. As an attacker, I want Erased and Dismissed Dudes gone for good, so that the Army is exactly what I see.

### Draft Crate gifts

27. As an attacker, I want an attack crate to offer a gift of free Dudes of one kind (as many as the kind's gift size: 20 Interns, 10 Termites, 1 Ram Crew…), so that crates still give a group.
28. As an attacker, I want painting the gift's kind to use the gift first and then switch to paying, so that the gift is placed the same way as any Dude.
29. As an attacker, I want the gift's count shown on its kind in the unit bar, so that I know how many free Dudes are left.
30. As an attacker, I want an Erased gift Dude to go back into the gift instead of my wallet, so that a gift can't be turned into gold.
31. As an attacker, I want an unused gift to be lost when the Round ends, as a free item is today, so that the rules match the defense side.

### The battle

32. As an attacker, I want the whole Army to start on the Board where it was painted and charge at once when the battle starts, so that it feels like a TABS charge.
33. As a defender, I want every Dude to come back each Round exactly where it was painted, so that I can plan against the Army I see.
34. As a defender, I want the Bouncer to throw a Dude back to the spot where it was painted, so that resetting a runner costs it the whole walk.
35. As a defender in Round 1, I want the game-made Army laid out in a seeded pattern in the zone, so that Round 1 plays by the same rules.
36. As a player, I want a replay of a battle from the same seed to be identical, so that battles stay reproducible.

### Mutations

37. As an attacker with Giant, I want every Nth Dude of a kind to be giant (5× health, half speed), N being the kind's gift size (1 in 20 Interns, every Ram Crew), so that the Army has tanks and the balance stays as it was.
38. As an attacker with Giant, I want the giants chosen in the order the Dudes were painted, so that I know which ones they are and painting can't game it.
39. As an attacker with Conga Line, I want each Stroke to walk in single file and share damage across its line, so that what I draw is what walks.
40. As an attacker with Conga Line, I want a one-Dude Stroke to be a line of one, so that the rule holds without exceptions.
41. As an attacker with Split, Explosive Shields, Ghost Mode or Gold Teeth, I want them to work as before, so that only the Squad-shaped rules change.

### Later tricks (written for tickets 18 and 19)

42. As a defender, I want Window size down to close Spawn zone rows from the top and bottom and push the Dudes in them into the nearest open row, so that they bunch up for my splash damage.
43. As a defender, I want squeezed Dudes allowed to stand closer than painting allows, so that squeezing really bunches them.
44. As a player, I want a squeezed Dude's painted spot to move with it, so that the Bouncer sends it back to where it now stands.
45. As an attacker paying for an Undo, I want to erase any of my Dudes (earlier Rounds included) with each counting its price toward the Undo price and nothing refunded, so that Undo stays painful.

### Saves and the report

46. As a player, I want the Army with its painted spots, Strokes and Rounds saved in my browser, so that a refresh loses nothing.
47. As a player with a save from before the Spawn zone, I want a fresh start with the usual short message, so that an old save never crashes the game.
48. As a player, I want the Round report's map of deaths to match the 22-column Board, so that the report shows the real Board.

## Implementation Decisions

- **Board shape (maze).** The Board is 22 × 14. The Spawn zone is columns 0–2, the Maze columns 3–21, the Goal on the right edge as now. The single Spawn line column constant becomes a zone (its columns and a "is this point in the zone" check). Placing a Piece in the zone is refused with its own reason. Routes start from any tile of the zone.
- **The Army (battle).** `Squad` is removed. The Army is a list of **placed Dudes**, each with its kind, its spot in tile units (x, y inside the zone), its Stroke number and the Round it was painted. Order in the list is paint order. A Dude's lane is its offset from its row's centre line, clamped to the widest lane.
- **Battle start.** Every placed Dude starts on the Board at its spot at step 0; nothing waits. The "waiting" list and the per-kind spawn interval go. Giant marks every Nth Dude of each kind in list order (N from the catalog); Conga Line uses the Stroke number where it used the Squad index.
- **Bouncer.** The Dude's state keeps its painted spot; the Bouncer throws it there.
- **Catalog.** Per Dude kind: `squadSize` and `squadPrice` are replaced by `dudePrice` (whole gold), `giftSize` (crate gift) and `giantEvery` (Giant's N), the last two starting at the old Squad size. A new paint rule: the room a Dude needs as a radius that grows with the square root of its size, tuned so a full zone holds about 500 Interns. All in the catalog.
- **Run actions.** `place-squad` is replaced by:
  - `paint-dude` { dudeKind, at (point in tiles), stroke } — refused when not the building phase of an Attack turn, outside the zone, too close to another Dude, kind not on sale, or not enough gold. Uses the gift first, else charges `dudePrice`.
  - `erase-dude` { index or id } — this Round's Dude: refund its price to the wallet, or to the gift if it came from one. An older Dude: Dismiss, no refund.
  - A new Stroke number is taken by the UI at the start of each drag; the Run keeps the next free one.
  The Run records, per Dude painted this Round, whether it came from gold or the gift, so Erase knows what to give back. Rewind already restores the Army and wallets from the Round's start.
- **Free item.** The squad free item becomes a gift `{ dudeKind, left }`. Painting that kind takes from `left` until it is 0.
- **Input (adapters/input).** `PointerGestures` gains paint handlers (start, move, end). A single-pointer press that starts inside the zone while a brush or the eraser is chosen becomes a paint gesture instead of a pan; a second finger cancels the paint and pinches as now. The screen wiring turns paint moves into `paint-dude` / `erase-dude` actions, trying a Dude at the pointer's spot on each move (the Run's spacing check decides).
- **UI.** The attack shop becomes the unit bar: one button per kind on sale (the kinds with no Unlock score, until Unlocks arrive) with name and price per Dude, plus a gift's kind when the shop doesn't sell it, the gift count on its kind, and an eraser. Painting a kind that is neither on sale nor gifted is refused (`not-on-sale`). Refusals show in the HUD message line as now.
- **Renderer.** The Spawn zone stripe covers 3 columns. The Squad view (a disc with "×20" per Squad) goes; painted Dudes are drawn where they stand during building. While the eraser is chosen, this Round's Dudes and older Dudes are told apart (e.g. older ones dimmed).
- **Round 1 Army.** The game-made Army becomes a seeded layout of placed Dudes in the zone (two blobs of Interns, as the two Squads were).
- **Storage.** The save version goes up by one; older saves get the existing fresh start and message.
- **Report.** The Round report's death map uses the Board's real width.
- **Later tickets.** Tickets 18 (Window size) and 19 (Undo) are blocked by these tickets and use the rules in stories 42–45.

## Testing Decisions

- Good tests here drive the public seams with plain data and check what a player would see: which Dudes stand where, what gold is left, which action is refused and why, what happens in the battle. No test reaches into private state.
- **run** (prior art: the run tests with scripted action lists): paint until gold runs out; refused for no room, outside the zone, wrong phase; gift used first and its count; Erase refunds gold or gift; Dismiss refunds nothing; Rewind restores the painted Army; Pieces refused in the zone.
- **battle** (prior art: the battle and mutations tests with `setupOf`): the whole Army is on the Board at step 0; Dudes reach the Goal from anywhere in the zone; Giant marks every Nth Dude of each kind in paint order; Conga Line lines up and shares per Stroke; the Bouncer returns a Dude to its painted spot; same-seed replay.
- **adapters/input** (prior art: the pointer gesture tests): a drag starting in the zone with a brush paints and never pans; a drag starting outside pans; a second finger turns a paint into a pinch; no brush means a drag pans.
- **catalog**: every kind has a whole-number `dudePrice`, and a full zone of Interns at the paint spacing is about 500 (a check on the tuning numbers, like the existing catalog tests).
- **adapters/storage** (prior art: the save round-trip tests): a painted Army round-trips; an old-version save starts fresh.
- **ui** (prior art: the shop tests): the unit bar lists per-Dude prices and the gift count.
- The swarm benchmark keeps 500 Interns, now all starting at once, within its budget.

## Out of Scope

- Units fighting each other, collisions between walking Dudes, or any change to how Dudes walk once the battle starts.
- Moving or dragging Dudes that are already placed (only Erase/Dismiss and Window size squeezing move or remove them).
- Painting more than one kind per Stroke, brush sizes, or fill tools.
- Converting old saves.
- Building Window size and Undo themselves (tickets 18 and 19); this spec only sets the rules they follow.
- Rebalancing prices beyond rounding the old Squad price per Dude.

## Further Notes

- Decision 0002 (`docs/decisions/0002-paint-single-dudes-not-squads.md`) has the reasoning and rejected options.
- The glossary already uses the new words: Spawn zone, Stroke, Erase, Dismiss.
- The new tickets come after ticket 16 (in progress), and ticket 18 should be marked blocked by them.
