# 39: Clear gold and an Army count in the top bar

**What to build:** The top bar shows **Attack gold** and **Defense gold** as two clearly labelled chips: orange "⚔ Attack gold 41" and blue "🛡 Defense gold 138". The chip for the side being played is bigger and lit up; the other is greyed out. Every price (Dude kind cards in the Unit bar, Pieces in the shop, Reroll) uses the same coin icon in its side's colour instead of "· 3g". When gold is spent or earned, the chip briefly pops "−3" or "+12". The top bar also shows the **Army** size ("👥 54 Dudes") so the player always knows how many Dudes they have. Requested by the owner on 2026-10-22 after playing the live build; this ticket is the whole scope.

**Blocked by:** 38 (Dude info button and a hint that fits)

**Status:** ready

**Touches:** ui/hud, ui/shop, ui/style

**Effort:** low

- [ ] Attack gold and Defense gold chips are labelled with words, in their side's colour, readable at a glance on a phone
- [ ] The current side's chip is larger and lit; the other side's chip is greyed out, and they swap at each turn change
- [ ] Every price uses the matching coin icon and colour; no "g" suffix left anywhere
- [ ] Spending or earning gold pops a short "−N" / "+N" on its chip (skipped when reduced motion is on, if the game honours it)
- [ ] The top bar shows the Army size and it updates as Dudes are painted, Erased or Dismissed (tested: the count comes from the Army, not a separate tally)
- [ ] Screenshots in the PR at 1910×873 and a 390×844 phone viewport, on both an Attack and a Defense turn
- [ ] Lint, type checks and tests pass
