# 27: Take back this Round's moves

**What to build:** A ↶ Take back button beside Fight, plus Ctrl+Z / Cmd+Z. Each press reverses the player's last action this Round, before the battle, and refunds exactly what it cost: a placed Piece, a whole Stroke, an eraser drag (Erase or Dismiss), a crate pick with whatever it gave at once, or a Settings trick dragged before the battle (a Window size drag puts back everything it moved). Presses step further back to the start of the Round. Crate rerolls and Undos are checkpoints it never goes past; the battle starting or a Rewind clears it. The history is saved with the Run. Built with today's button style; ticket 31 restyles it. See `docs/specs/take-back.md`.

**Blocked by:** None (can start immediately)

**Status:** done

**Touches:** run, adapters/storage, ui/hud, ui/hints, run-screen

**Effort:** medium

- [x] The Run has a `take-back` action with `nothing-to-take-back` and wrong-phase refusals; run tests cover every takeable action restoring Board, Army, wallets, crate, free items and sliders exactly
- [x] A Stroke and an eraser drag each go back in one press; Gift Dudes return to the Gift
- [x] A reroll and an Undo stop Take back; `start-battle` and a Rewind clear the history; a slider dragged mid-battle can't be taken back
- [x] The history round-trips through the save, and a save without it loads with nothing to take back (save version unchanged)
- [x] The button sits beside Fight, is greyed out with nothing to take back, is hidden during a battle, is at least 44 px tall on touch, and names the action it would reverse
- [x] Ctrl+Z / Cmd+Z takes back; the message line says "Took back: <thing>"
- [x] The first-Run hints for Rounds 1 and 2 mention Take back
- [x] Each Take back is logged at info with the action kind and gold returned
- [x] README describes Take back
