# 38: Icon set and icon lookup

**What to build:** A hand-drawn SVG icon for every store item, money item, hazard and Mascot mood in The App's flat style, plus pencil-drawn icons for the Letters button and the savings tin. Also an icon lookup that every caller uses, so a missing icon fails a test. The icons show up at once in the supplies bar (Fertiliser, Pesticide) and on the balance badge (Labour Points, or Debt) (app polish spec: stories 12, 15–22, 41; "Implementation Decisions": Icons).

**Blocked by:** 37 (The App look: theme, font and tap feedback)

**Status:** ready

**Touches:** assets/icons, adapters/app-look, adapters/app-overlay

**Effort:** medium

- [ ] App icons under `assets/icons/app/` in one flat style (one square view box, two or three flat fills from the App palette, a soft highlight, no outlines, no text): Generator, tools, rest hour, Call Home, a Plot of land, Fertiliser, Pesticide, Labour Points, pay slip, Debt, school fees, Sandstorm, Heatwave, Bollworms, and the Mascot in four moods (cheerful, proud, stern, alarmed), smiling in every one
- [ ] Pencil icons under `assets/icons/pencil/`, matching the savings tin's drawing: the Letters button and the savings tin
- [ ] Every icon is written by hand as SVG: no AI art and no image API. No icon shows a person; the Mascot is the only face
- [ ] Each icon has a row in `assets/CREDITS.md` (drawn by hand for this game, CC0 1.0); `.import` files are committed with an import scale that stays sharp at the largest size shown
- [ ] The App look's icon lookup maps store item, supply, money item, Disaster, Bollworms and mood ids to textures
- [ ] The supplies bar's buttons show the Fertiliser and Pesticide icons, and the balance badge shows the Labour Points icon, or the Debt icon while in Debt
- [ ] GUT test: every store front item id, supply, money item, Disaster, Bollworms and mood gets a loaded texture from the lookup
- [ ] No diff under `src/rules`, `src/config`, `src/content` or `tests/rules`
- [ ] PR shows a contact sheet of every icon at its shown size, plus screenshots
