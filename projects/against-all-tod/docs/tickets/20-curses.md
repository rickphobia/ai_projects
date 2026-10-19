# 20: Curses

**What to build:** From Round 2, a random Curse is announced before the player builds and lasts one Round. Four hurt the defense (Rust, Power Cut, Earthquake, Audit) and four hurt the attack (Traffic Jam, Mud, Stage Fright, Union Break).

**Blocked by:** 14 (Tax Booth, Grinder, Bouncer, Decoy Goal), 15 (Mutations), 19 (Undo)

**Status:** done

**Touches:** battle/curses, catalog/curses, run, ui/hud

**Effort:** medium

- [x] Run rolls one Curse per Round from Round 2 with the seeded RNG; a Rewind keeps the same Curse
- [x] HUD announces the Curse with its effect before building starts
- [x] Rust: towers fire 20% slower. Power Cut: Lighthouses and Sirens off. Earthquake: one random Piece moves one tile (never sealing the Goal). Audit: Tax Booths pay nothing
- [x] Traffic Jam: the Army sets off one Dude at a time, in paint order, instead of charging together. Mud: Dudes 20% slower. Stage Fright: Hype Men don't work. Union Break: Wall-breakers can't damage Pieces
- [x] One battle test per Curse; a run test for rolling and Rewind
