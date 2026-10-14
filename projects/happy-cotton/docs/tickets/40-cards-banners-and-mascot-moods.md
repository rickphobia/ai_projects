# 40: Cards, banners and Mascot moods

**What to build:** The Hand-in card and pay slip become glossy App cards, with the money icons on the pay slip's lines. The Disaster banner shows the coming Disaster's icon. The Mascot is drawn from SVG and pulls a mood (cheerful, proud, stern, alarmed) that fits each App message, still smiling, with the topic's icon in the speech bubble where a message has one. The Study Session room stays bare and muted, with only its text in the shared muted look (app polish spec: stories 31–36, 42; "Implementation Decisions": Cards, banners and the Mascot).

**Blocked by:** 38 (Icon set and icon lookup)

**Status:** ready

**Touches:** adapters/app-overlay/cards

**Effort:** low

- [ ] The Hand-in card and the pay slip card use the App look's card style; the pay slip shows the Labour Points, Debt and school fees icons beside their lines
- [ ] The Disaster banner shows the Sandstorm or Heatwave icon; its warned and striking colours are App look tokens
- [ ] The Mascot draws its mood's SVG instead of circles
- [ ] A table maps every App message key to a mood and an optional topic icon; a key not in the table falls back to cheerful with no icon
- [ ] The speech bubble shows the topic icon when a message has one
- [ ] The Study Session room's drawing is unchanged; its time-left text uses the muted look
- [ ] GUT tests: every key in the Farm's message keys has a mood; the bubble shows a topic icon; the banner shows the right Disaster's icon; existing Hand-in, pay slip, banner and speech bubble tests pass, changed only where a node they find moved
- [ ] No diff under `src/rules`, `src/config`, `src/content` or `tests/rules`
- [ ] PR shows screenshots of each Mascot mood, the cards and the banner
