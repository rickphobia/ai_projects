# 39: Store as cards

**What to build:** The store shows each item as a glossy card: its icon (with a tier badge on an Upgrade), name, The App's pitch, effect and Quota rise, a price chip with the Labour Points icon, and the buy button. A card looks affordable, locked (greyed, with a lock mark and The App's reason) or complete. On a purchase the bought card pulses and the balance badge bumps (app polish spec: stories 13–14, 23–30; "Implementation Decisions": The store as cards).

**Blocked by:** 38 (Icon set and icon lookup)

**Status:** ready

**Touches:** adapters/app-overlay/store

**Effort:** low

- [ ] Each store item is a card with icon, name, pitch, effect and Quota rise (or tomorrow's price for a supply), price chip and buy button
- [ ] Generator and tools cards badge their icon with the tier about to be bought, and a fully upgraded Upgrade or fully bought land shows a complete mark
- [ ] Affordable, locked and complete cards look different; a locked card shows the same refusal the store shows today and its button is off
- [ ] The tin's pencil-drawn pay button stays on the card and behaves as before
- [ ] Sections and their order stay; the store scrolls vertically and fits a 1280×720 screen; buttons are at least 88 base pixels in their short side
- [ ] A purchase pulses the bought card and bumps the balance badge; with reduced motion neither plays; purchase confetti stays
- [ ] GUT tests cover the three card looks, the tier badge, and no tween with reduced motion; existing store panel tests pass, changed only where a node they find moved
- [ ] No diff under `src/rules`, `src/config`, `src/content` or `tests/rules`
- [ ] PR shows screenshots of the store on a phone held sideways and on a desktop
