# 26: Erase and Dismiss

**What to build:** The unit bar gets an eraser. Dragging it over Dudes painted this Round Erases them for their full price back (or back into the crate gift they came from); dragging it over Dudes from earlier Rounds Dismisses them to make room, refunding nothing. While the eraser is chosen, older Dudes are dimmed so the player can see which ones refund. See `docs/specs/spawn-zone.md`.

**Blocked by:** 25 (Paint Dudes by dragging, paying per Dude)

**Status:** done

**Touches:** run, ui/shop, renderer/units

**Effort:** low

- [x] An `erase-dude` Run action: a Dude painted this Round is Erased with its price refunded to gold, or to the gift if it came from one; an older Dude is Dismissed with no refund; refused outside an Attack turn's building phase
- [x] The eraser works with the same drag gesture as painting, removing every Dude it passes over
- [x] Older Dudes are dimmed while the eraser is chosen
- [x] Rewind after a lost Round still restores the Army and wallets as the Round began
- [x] Tests: Erase refunds gold, Erase refunds the gift, Dismiss refunds nothing, refused in the wrong phase, Rewind
- [x] Spec, README and glossary match
