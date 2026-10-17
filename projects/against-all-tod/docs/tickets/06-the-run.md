# 06: The Run

**What to build:** A full solo Run: Round 1 is a Defense turn against a game-made Army; every won Round switches sides. On Attack turns the player places Squads on the Spawn line and the whole Army returns each Attack turn. The player has 3 Lives; a lost Round costs one and Rewinds the Board to the start of that Round. Score is Rounds won; at zero Lives the Run ends with the Score and best Score shown, and a new Run starts in one click.

**Blocked by:** 03 (Watch a Defense turn)

**Status:** ready

**Touches:** run, ui/hud, ui/end-screen, renderer/squads

**Effort:** medium

- [ ] Run is a pure state machine driven by actions (place Piece, place Squad, start battle, battle finished, continue, new Run); illegal actions are refused with a typed reason
- [ ] Odd Rounds are Defense turns, even Rounds are Attack turns; Round N = Rounds won + 1
- [ ] A Squad is one Dude kind on one Spawn line tile; placed Squads and Pieces can't be moved or removed
- [ ] A lost Round costs one Life and Rewinds the Board and Army to the start of that Round; the Round number is kept
- [ ] At zero Lives the Run ends; best Score is kept for the session (saving comes in ticket 08)
- [ ] HUD shows Round, side, Lives and Score
- [ ] Run state is plain serialisable data
- [ ] Tests: scripted Runs that switch sides, lose a Life and Rewind, and end at zero Lives
