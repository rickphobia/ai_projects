# 41: Unit bar and Piece shop at the bottom, TABS style

**What to build:** The Unit bar (attack) and the Piece shop (defense) move from the top of the screen to a tray along the bottom, styled like the unit picker in Totally Accurate Battle Simulator (TABS): a row of square cards, each with a big portrait, the name and the price, the chosen one raised and outlined, with Eraser, Take back and Fight at the tray's right end. The board gets the freed space at the top. The top keeps only the status chips (Lives, gold, Army count, Score, Round, side). The help line sits just above the tray. Requested by the owner on 2026-10-22 after playing the live build; this ticket is the whole scope.

**Blocked by:** 38 (Dude info button and a hint that fits)

**Status:** ready

**Touches:** ui/hud, ui/shop, ui/style

**Effort:** low

- [ ] The Unit bar and the Piece shop are a bottom tray of portrait cards with name and price; the chosen card is clearly raised and outlined
- [ ] Eraser, Take back and Fight sit at the tray's right end; the ⓘ button from 38 stays in each card's top-right corner
- [ ] The tray never covers the Spawn zone or the Goal: the board is sized to the space between the top bar and the tray
- [ ] With more cards than fit, the tray scrolls sideways; on a 390×844 phone the cards stay big enough to tap
- [ ] Screenshots in the PR of an Attack and a Defense turn at 1910×873 and on a phone
- [ ] Lint, type checks and tests pass
