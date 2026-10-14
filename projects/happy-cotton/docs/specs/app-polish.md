# Happy Cotton: The App's look and icons

**Status:** spec. Design decisions agreed with the owner on 2026-10-14. The ones settled without the owner are listed for confirmation in "Further Notes". Adapter work only: built after the land and hazards tickets (26–36), so every store item, money item and hazard it draws already exists.

## Problem Statement

The satire depends on a gap: a grim, grounded field under a bright, cheerful state app. The field is done, but The App still looks like a placeholder. Its panels are flat pink rectangles, its text uses Godot's default font, the store is a list of text rows, and the Mascot is a few circles with a fixed grin. Nobody would mistake it for a real state-issued phone app, so the clash is weak.

There is also no shared look in the code. Six App files each build their own rounded boxes with their own colour constants, so the same pink is defined again and again, button sizes differ from screen to screen, and some tap targets are too small on a phone held sideways.

## Solution

The App gets a polished look: bright, glossy and a little too cheerful, like a real government app that tries too hard. It uses one rounded font, one set of colours, rounded glossy panels and buttons that respond when pressed, and a hand-drawn flat icon for every item it sells or mentions. The store becomes a list of cards. Each card shows the item's icon, name, price and whether the Worker can afford it, or why not. The Mascot gets a few moods, and in every one of them it is still smiling.

Only The App gets bright. The field, the Study Session room and anything that belongs to the Worker or his Family keep their look. The Children's letters and the Worker's savings tin stay paper and pencil, drawn by hand, nothing like The App, and their icons are pencil drawings too. The title screen and Settings share The App's font, spacing and button shapes but keep calm, muted colours, so the content note keeps a serious frame and the brightness starts when The App does.

No rule changes. The Farm plays exactly as before; only how The App draws it changes.

## User Stories

### The App's look

1. As a player, I want The App to look like a real, polished state-issued phone app, so that the satire of a cheerful state voice lands.
2. As a player, I want The App's colours to be bright and slightly too cheerful, so that they clash with the dust and grey of the field.
3. As a player, I want The App's panels and buttons to be rounded and glossy, so that it feels like the over-designed apps I know.
4. As a player, I want one rounded, friendly font across The App, so that it reads as one product rather than a debug screen.
5. As a player, I want every App button to look the same in the same state (ready, pressed, off), so that I can tell what I can tap without reading.
6. As a player, I want a button to squish slightly when I press it and spring back, so that The App feels responsive and eager.
7. As a player with reduced motion on, I want no squish, pulse or bump animations, so that The App stays still for me.
8. As a player who set a larger text size, I want The App's new font to follow that setting everywhere, so that I can still read it.
9. As a player, I want The App to keep dimming when the Generator stops, so that I still see it run on the Worker's body.
10. As a player on a phone held sideways, I want every App button big enough to tap with a thumb, so that I don't mis-tap.
11. As a player on a phone held sideways, I want The App's panels to fit on screen without covering each other, so that nothing is cut off.

### Icons

12. As a player, I want every item in the store to have its own icon, so that I can find things at a glance like in Hay Day.
13. As a player, I want the Generator and tools Upgrades to show which tier I'm about to buy as a small number on their icon, so that I see my progress without reading.
14. As a player, I want a fully upgraded item's icon to show that it is complete, so that I know there is nothing left to buy.
15. As a player, I want the supplies bar to show the Fertiliser and Pesticide icons, so that I pick the right supply with one look.
16. As a player, I want Labour Points, the pay slip, Debt and school fees to have their own icons, so that The App's money talk is quick to read.
17. As a player, I want Debt to keep its red warning look with its own icon, so that it still stands out.
18. As a player, I want the Sandstorm, Heatwave and Bollworms to have icons, so that a warning reads before I finish the sentence.
19. As a player, I want all of The App's icons drawn in one consistent flat style, so that they look like one designer made them.
20. As a player, I want the Letters button and the savings tin drawn in pencil, not in The App's style, so that the Family and the Worker's secret stay human and apart from the state.
21. As a player, I want icons to show objects and never people, so that nobody real is turned into an App sticker.
22. As the owner, I want the icons drawn by hand as SVG files and credited, with no AI art and no image API, so that every asset in the game is traceable and free to use.

### The store

23. As a player, I want the store to show each item as a card with its icon, name, The App's pitch, price and buy button, so that it looks like a real in-app shop.
24. As a player, I want a card I can afford to look bright and inviting, so that The App's pressure to spend is felt.
25. As a player, I want a card I can't buy right now to look locked and say why, so that I know whether to wait, earn or give up.
26. As a player, I want the Quota rise of an Upgrade or a Plot shown plainly on its card, so that the cost to the Worker isn't hidden.
27. As a player with hidden savings, I want the tin's pencil-drawn pay button to stay on the card, so that paying from the tin still feels like a secret, not an App feature.
28. As a player, I want the store's sections (Upgrades, land, supplies, Privileges) kept, so that I find things where I found them before.
29. As a player, I want a bought card to pulse and my balance to bump, so that the purchase feels rewarded the way The App wants.
30. As a player on a phone, I want the store to scroll when the cards don't fit, so that I can reach every item.

### Cards, banners and the Mascot

31. As a player, I want the Hand-in card and the pay slip to look like glossy App cards with their icons, so that the state's paperwork looks friendly.
32. As a player, I want the Disaster banner to show the Sandstorm or Heatwave icon with its countdown, so that I know at once what is coming.
33. As a player, I want the Mascot to pull a face that fits what The App is saying (proud at a met Quota, stern at a missed one, alarmed at a Disaster), so that the state's voice has a character I learn to read.
34. As a player, I want the Mascot to keep smiling in every mood, even the stern and alarmed ones, so that the forced cheer is never dropped.
35. As a player, I want the speech bubble to show the icon of what The App is talking about (a hazard, the pay slip, Debt, school fees), so that I take in a message at a glance.
36. As a player, I want the Study Session room to stay bare and muted, only its text using the shared font and spacing, so that it doesn't read as part of The App.

### Title screen, Settings and letters

37. As a player, I want the title screen to use the shared font, spacing and button shapes with muted colours, so that it looks finished but keeps the content note serious.
38. As a player, I want Settings to match the title screen's look, whether I open it from the title or from The App, so that it feels like one game.
39. As a player, I want the Children's letters to stay handwritten on paper, with their buttons easy to tap on a phone, so that reading them is never The App's experience.

### Engineering

40. As a developer, I want The App's colours, font, sizes, spacing and button styles defined in one place, so that a colour change is one edit.
41. As a developer, I want a check that every store item, supply, money item, hazard and Mascot mood has an icon, so that adding an item without an icon fails the tests.
42. As a developer, I want a check that every App message key has a Mascot mood, so that a new message can't leave the Mascot blank.
43. As a developer, I want the rules, tuning and App text left untouched, so that the polish pass can't change how the game plays.

## Implementation Decisions

### One App look, built in code

- A new adapter module, the **App look**, owns The App's colour tokens, font, font sizes, spacing scale, corner radii, and panel and button styles. It builds Godot `Theme` objects from those tokens in code, not in a `.tres` file, so the values are reviewed in diffs and tested like everything else (the project is edited headless).
- It offers two palettes on the same layout: **bright** (The App) and **muted** (the title screen, Settings, and the Study Session room's text). Fonts, spacing, radii and button shapes are shared.
- Every App overlay part sets the App look's theme on its root control. A `CanvasLayer` breaks theme inheritance, so each layer's root sets it itself.
- The text-size setting scales the theme's font sizes in one place. The parts that rescale on a settings change take a rescaled theme instead of setting sizes one by one.
- The per-file rounded-box helpers and colour constants in the App overlay go away. A colour that means something specific (Debt red, the chosen supply's yellow, a Disaster's orange) becomes a named token in the App look.
- "Glossy" means a light highlight along the top edge and a soft shadow beneath. Ticket 37 picks how: a flat style box with a highlight border and a shadow, or an SVG nine-patch with a gradient.
- Tap feedback lives in the App look: App buttons squish on press and spring back, with the pivot at their centre. With reduced motion nothing animates. Feedback never delays the press reaching the rules.
- The Generator dimming (the App goes grey while the Worker isn't running) keeps working on top of the theme.

### Font

- The App uses one rounded, friendly font family under the SIL Open Font License, such as Nunito or Baloo 2 (ticket 37 picks one and checks its size in the web export). The font file is pinned in `assets/`, with its OFL licence text next to it.
- The credits rule changes from "only CC0 assets" to "CC0, or SIL OFL 1.1 for fonts, with the licence file next to the font". The owner agreed this on 2026-10-14.
- The Children's handwriting font stays as it is.

### Icons

- The icons are hand-written SVG files under `assets/icons/`, in two sets:
  - `app/`: The App's flat style. One square view box, two or three flat fills from the App palette, a soft highlight, rounded shapes, no outlines and no text.
  - `pencil/`: the Worker's and Family's style. Pencil strokes on paper, matching the savings tin. Only the Letters button and the savings tin use it.
- The App icons cover:
  - the store items: Generator, tools, rest hour, Call Home, a Plot of land, Fertiliser and Pesticide. The supplies bar uses the same Fertiliser and Pesticide icons.
  - the money items: Labour Points, the pay slip, Debt and school fees.
  - the hazards: Sandstorm, Heatwave and Bollworms.
  - the Mascot's moods.
- Upgrades get one icon each, not one per tier. The store card draws the tier about to be bought as a small number badge on the icon, and a "complete" mark once the Upgrade is fully bought. This keeps working if tuning adds or removes a tier.
- Icons show objects, never people. The Mascot is the only face in The App.
- Every icon file gets a row in `assets/CREDITS.md`: drawn by hand for this game, CC0 1.0. No AI-generated art and no image API.
- Godot imports SVGs as textures at a fixed scale, so each icon is imported at a scale that stays sharp at the largest size it is shown. The `.import` files are committed, as for the other assets.
- An **icon lookup** in the App look maps an id to its texture: store item ids as the store front names them, supply ids, money item ids, Disaster and Bollworm ids, and Mascot moods. Every caller goes through it, so a missing icon shows up in one test.

### The store as cards

- Each store row becomes a card with:
  - the icon (with its tier badge for an Upgrade);
  - the name, The App's pitch, and the effect and Quota rise (or tomorrow's price for a supply);
  - a price chip with the Labour Points icon;
  - the buy button.
- A card has three looks:
  - **affordable**: bright, with the button lit;
  - **locked**: greyed, with a lock mark and The App's refusal text. This covers every reason the store front gives today, including not enough Labour Points.
  - **complete**: a fully upgraded Upgrade, or fully bought land.
- The tin's pay button stays pencil-drawn on the card, exactly as it behaves today.
- The sections and their order stay. The store keeps scrolling vertically.
- On a purchase the bought card pulses once and the balance badge bumps. The existing purchase confetti stays. With reduced motion, none of these play.

### Cards, banners and the Mascot

- The Hand-in card and the pay slip card take the App look's card style. The pay slip shows the money item icons beside its lines (Labour Points, Debt, school fees).
- The Disaster banner shows the coming Disaster's icon. Its warned and striking colours become App look tokens.
- The Mascot is redrawn from SVG, one drawing per mood: **cheerful** (the default), **proud**, **stern** and **alarmed**. It smiles in every one.
- A table in the App overlay maps each App message key to a mood, plus an optional topic icon shown in the speech bubble. For example, Quota met is proud, Quota missed is stern, a Disaster warning is alarmed with that Disaster's icon, and the pay slip is cheerful with the pay slip icon. A key missing from the table uses cheerful with no icon, and a test makes sure every key in the Farm's message keys is in the table. This uses the message keys the rules already emit, so it is adapter work, not a rule change.
- The Study Session room keeps its bare, muted drawing. Only its time-left text takes the muted palette's font and spacing.

### Title screen, Settings and letters

- The title screen and Settings use the muted palette: the shared font, spacing, radii and button states, in today's calm colours. The content note's wording doesn't change.
- The Children's letters keep their paper, ink and handwriting. Their buttons meet the tap-target size. The Letters button and the savings tin get their pencil icons.

### Phone layout

- The game is landscape only (the rotate prompt covers portrait) and is laid out on the 1280×720 base viewport. A phone held sideways shows that at about half size.
- Every button in The App, the title screen, Settings and the letters is at least 88 base pixels in its short side, about 44 px on a phone. Text is never below the App look's smallest size before the text-size setting is applied.
- The App look's spacing scale (multiples of 8 base pixels) is used for every margin and gap, and no App panel draws outside a 1280×720 screen.

### What stays

- Untouched: the rules, tuning, App text, Family text, sources, the field adapters, the sounds, the save and the debug panel.
- The App still shows what it is given and decides nothing.

## Testing Decisions

- Tests check what a player could see or do, not how a node tree is built. For example: a locked card's button is off and its card shows the refusal; every App button's rect is at least 88 base pixels in its short side; an overlay's root uses the App look's theme; with reduced motion, pressing a button starts no tween.
- **App look:** both palettes build a theme with every token set; the text-size setting scales font sizes; the icon lookup returns a loaded texture for every store front item, supply, money item, Disaster, Bollworms and mood. These are GUT tests against the module itself, which is the one seam this spec adds.
- **Mascot moods:** every one of the Farm's message keys has a mood, and the speech bubble shows the topic icon for keys that have one.
- **Existing adapter tests** (store panel, supplies bar, Hand-in card, pay slip card, Disaster banner, speech bubble, title screen, settings panel, letters view) keep passing. A test may be changed only where it finds a node by a layout detail that moved, for example the store row becoming a card. It is never changed to weaken what it asserts, and the PR names each such change.
- **Rule tests are not touched.** A diff to `tests/rules/`, `src/rules/`, `src/config/` or `src/content/` in any of these tickets is a review failure.
- Prior art: the store panel and supplies bar tests, which already find buttons and labels by name and text; the speech bubble test for the bubble; and the title screen test for a screen with settings applied.
- Looks that a test can't judge (gloss, icon quality, the Mascot's faces, the field staying grim) are checked by eye in each PR's preview, on a phone held sideways and on a desktop. The PR body includes screenshots.

## Out of Scope

- Any change to rules, tuning, prices, balance, App text or Family text.
- The field's look, the 3D scene, lighting and sound, including any new App sounds for buying or tapping.
- New screens, new store items or new App messages.
- A portrait layout.
- Animated or sprite-sheet Mascot animation beyond swapping its mood drawing.
- Restyling the debug panel.
- The story and endings screens (their spec is still a draft). When they are built, they use the App look.

## Further Notes

- Agreed with the owner on 2026-10-14:
  - Letters and the savings tin stay hand-drawn, and their icons are pencil drawings.
  - The title screen and Settings use the shared layout with muted colours.
  - The font is one OFL font, and the credits rule is widened for fonts.
  - Upgrades get one icon plus a tier badge.
- Settled without the owner, to confirm:
  - The Study Session room counts as "not The App" (its own code says so), so it stays muted, like the title screen.
  - There are four Mascot moods (cheerful, proud, stern, alarmed), and every one smiles.
  - The speech bubble shows a topic icon for messages about a hazard or a money item.
  - The tap-target minimum is 88 base pixels.
  - The bought card pulses and the balance badge bumps on a purchase.
- Dignity rule (main spec, "Content rules"):
  - The bright look belongs to the state, never to the Worker or his Family.
  - No icon shows a person.
  - No Uyghur dress, motif or script is used as decoration in The App's cheerful style.
