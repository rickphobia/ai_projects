# 38: Dude info button and a hint that fits

**What to build:** Each Dude kind's card in the Unit bar gets a small ⓘ button in its top-right corner. Tapping it opens a card-style panel with that Dude kind's portrait, name, price, its stats from the Dude catalogue and its description, and closes on ✕ or a tap outside. Tapping ⓘ never picks the Dude kind as the brush. The help text under the Unit bar is no longer cut off: today the "Unit bar: pick a Dude kind…" line and the "Hint: …" line are squeezed into one line's height and clipped (owner's screenshot, 1910×873 browser window, 2026-10-22). Shorten the Unit bar line now that the ⓘ panel explains each Dude, and make the help area grow to fit its text instead of clipping. Requested by the owner after playing the live build; no spec, this ticket is the whole scope.

**Blocked by:** None (can start immediately)

**Status:** done

**Touches:** ui/hud, ui/dude-info

**Effort:** low

- [x] Every Dude kind card in the Unit bar shows an ⓘ button in its top-right corner, big enough to tap on a phone
- [x] ⓘ opens a panel in the existing card style with portrait, name, price, stats and description, all read from the Dude catalogue (tested: the panel's content comes from the catalogue entry, nothing hard-coded per Dude kind)
- [x] Tapping ⓘ doesn't change the chosen Dude kind; ✕, a tap outside and Escape close the panel
- [ ] Help text under the Unit bar and the Hint line are fully readable, never clipped or overlapping, at 1910×873, 1280×720 and a 390×844 phone viewport (screenshots of each in the PR)
- [x] Lint, type checks and tests pass
