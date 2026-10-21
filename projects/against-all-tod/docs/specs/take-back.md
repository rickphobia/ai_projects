# Take back: undo this Round's moves before the fight

## Problem Statement

A misplaced Piece stays where it landed: the defender has no way to remove it, so one slip of the finger can cost a whole Maze plan and its gold. The attacker can Erase single Dudes, but a bad Stroke has to be rubbed out Dude by Dude, and a wrong crate pick or a Settings trick bought by mistake can't be taken back at all. Building is supposed to be about choices, not about never mistapping.

## Solution

A **Take back** button next to Fight. Each press reverses the player's last action this Round, before the battle, and gives back everything it cost: a placed Piece comes off the Board with its gold, a whole Stroke disappears with its gold or Gift, a crate pick goes back into the crate, a Settings trick bought this Round is returned to where it stood with its price. Pressing again steps further back, as far as the start of the Round. Crate rerolls and Undos can't be taken back: they are checkpoints that Take back never goes past. The history survives a reload and is cleared when the battle starts or the Round is Rewound.

"Take back" is a new glossary word, kept apart from **Undo** (reversing a Settings trick by destroying your own Pieces or Dudes).

## User Stories

### Taking back

1. As a defender, I want to take back a Piece I just placed, with its full price back, so that a mistap doesn't cost me a Maze plan.
2. As a defender, I want to take back a free Piece from a crate and get it back as my free item, so that a free Piece is never lost to a mistap.
3. As an attacker, I want to take back my last Stroke as a whole, so that I don't have to rub out a bad Stroke Dude by Dude.
4. As an attacker, I want a taken-back Stroke to refund gold for the Dudes I paid for and return Gift Dudes to the Gift, so that it matches what the Stroke cost.
5. As an attacker, I want to take back an Erase or a Dismiss, so that a sweep of the eraser over the wrong Dudes can be fixed.
6. As a player, I want to take back a crate pick, so that the item goes back into the crate and I can pick again.
7. As a player, I want taking back a crate pick to also take back what the pick gave at once (gold, a Mutation, a free Undo), so that a pick can't be turned into free gold.
8. As a player, I want to take back a Settings trick I bought this Round, so that the slider goes back to where it stood and I get its price back.
9. As a defender, I want taking back a Window size drag to put back every Piece and Dude it moved, so that the Board is exactly as before.
10. As a player, I want each press of Take back to reverse one more action, newest first, so that I can step back as far as I need.
11. As a player, I want Take back to stop at the start of the Round, so that earlier Rounds stay as they were.

### Limits

12. As a player, I want a crate reroll to be a checkpoint that Take back never goes past, so that I can't fish for a better crate for free.
13. As a player, I want an Undo to be a checkpoint too, so that Undo stays painful on purpose.
14. As a player, I want Take back to work only in the building phase, never during a battle, so that a battle can't be changed after it starts.
15. As a player, I want a Settings trick dragged during a battle to stay bought, so that the double mid-battle price stays real.
16. As a player, I want the Take back history cleared when the battle starts, so that every Round starts fresh.
17. As a player, I want the history cleared when a lost Round is Rewound, so that the Rewind gives me a clean start.

### The button

18. As a player, I want a ↶ Take back button next to Fight in the current side's colour, so that I can find it where I'm about to commit.
19. As a player, I want the button greyed out when there is nothing to take back, so that I know at a glance whether it will do anything.
20. As a player, I want the button hidden during a battle, so that it never looks usable when it isn't.
21. As a player, I want a short message saying what came back ("Took back: Crate Wall"), so that I know which action was reversed.
22. As a player, I want refunded gold to float back to the wallet as a "+20g" coin, so that I see the gold return.
23. As a desktop player, I want Ctrl+Z (Cmd+Z on a Mac) to Take back, so that it works like every other editor.
24. As a phone player, I want the button at least 44 px tall, so that I can tap it reliably.
25. As a new player, I want the first-Run hints to mention Take back, so that I learn it exists before I need it.

### Saves

26. As a player who refreshes during the building phase, I want my Take back history kept, so that a reload doesn't quietly change the rules.
27. As a player with a save from before Take back, I want it to load with nothing to take back, so that my Run isn't thrown away.

## Implementation Decisions

- **run.** A new `take-back` action, refused with its own reasons: `nothing-to-take-back` when the history is empty, and the existing wrong-phase reason outside the building phase. The Run keeps a **Take back history** for the current Round: one entry per takeable action, newest last. Takeable actions are `place-piece`, a whole Stroke of `paint-dude`, `erase-dude` (Erase and Dismiss), `take-from-crate` and `drag-slider` before the battle. `reroll-crate` and `undo` clear the history (they are checkpoints). `start-battle`, a Rewind and the next Round clear it.
- **One entry per Stroke.** The UI already takes a new Stroke number at the start of each drag; every `paint-dude` with the same Stroke number joins the newest entry instead of making a new one. The same holds for an eraser drag: the UI sends an eraser-drag number with each `erase-dude`, and erasures with the same number form one entry.
- **Entries store what changed, not a whole snapshot.** An entry records the parts of the Run the action changed: the wallets, the crate, the free items, the Mutations, the free Undos and the sliders as they were before, plus the Pieces and Dudes it added (by position in their lists) and the ones it removed or moved (with where they stood). A whole Board and Army per Stroke would fill browser storage within a Round. Taking back applies the entry in reverse and removes it.
- **Refunds are exact.** Because an entry puts back the wallets as they stood before the action, a taken-back action refunds exactly what it cost, including double prices and Gift Dudes. No price is recalculated.
- **Glossary.** **Take back** is defined in the glossary next to **Undo**. Code uses `takeBack` / `TakeBack…` names, never `undo`, so the two can't be confused.
- **adapters/storage.** The history is saved with the Run. A save without it loads with an empty history; the save version does not change, so old saves keep working.
- **UI.** A Take back button beside Fight, built with today's button styles (the art pass restyles it). It shows the name of the action it would reverse in its tooltip and accessible label, and is greyed out when the history is empty. Ctrl+Z / Cmd+Z sends the same action. The message line shows "Took back: <thing>". The "+Xg" coin uses the gold pop from the art pass when that lands; until then the wallet number changes as it does today.
- **Hints.** The first-Run hints for Rounds 1 and 2 mention Take back.
- **Logging.** Each Take back is logged at info with the action kind it reversed and the gold returned.

## Testing Decisions

- Tests drive the **run** seam with scripted action lists, as the existing run tests do, and check what the player would see: Pieces on the Board, Dudes in the Army, wallets, the crate and the sliders. No test reaches into the history's private shape.
- **run**: each takeable action taken back restores the Run exactly as it stood before it (Board, Army, wallets, crate, free items, sliders); a Stroke goes back in one press; Gift Dudes return to the Gift; several presses step back in order; a reroll and an Undo stop Take back; `start-battle` and a Rewind clear the history; a slider dragged during a battle can't be taken back; `nothing-to-take-back` and wrong-phase refusals.
- **adapters/storage**: the history round-trips; a save without it loads with nothing to take back.
- **ui** (prior art: the shop and HUD tests): the button is greyed out with an empty history and shows the action it would reverse.
- Prior art: `tests/run/` scripted Runs, the save round-trip tests.

## Out of Scope

- Redo.
- Taking back anything from an earlier Round, or after the battle starts.
- Taking back crate rerolls or Undos.
- The art-pass look for the button (the art pass restyles every button).

## Further Notes

- Agreed in the art-pass grilling; see the glossary entry **Take back**.
- Built in parallel with the art pass: it touches the Run, the save and the HUD, not the renderer.
