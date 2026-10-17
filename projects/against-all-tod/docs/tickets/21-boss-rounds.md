# 21: Boss Rounds

**What to build:** Every fifth Round is a Boss Round. On a Defense turn The Landlord joins the attacking Army with huge health and evicts a Piece every 10 tiles he walks. On an Attack turn The HR Department appears in the Maze and turns Wall-breakers back the way they came. Winning a Boss Round gives a boss crate: 2 picks from 5, with a chance of a free Undo.

**Blocked by:** 20 (Curses)

**Status:** ready

**Touches:** battle/bosses, catalog/bosses, run, ui/crate

**Effort:** medium

- [ ] Rounds 5, 10, 15… are Boss Rounds; the boss is added for that Round only and comes back on a Rewind
- [ ] The Landlord: huge health, destroys a Piece every 10 tiles walked (never sealing the Goal)
- [ ] The HR Department: a tower that turns Wall-breakers in range back toward the Spawn line
- [ ] Boss crate offers 5 items, 2 picks, with a catalog chance of a free Undo
- [ ] Tests: Boss Round timing, each boss's effect, boss crate size and picks
