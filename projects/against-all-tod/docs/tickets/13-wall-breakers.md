# 13: Wall-breakers

**What to build:** Pieces get health, and three Wall-breakers can damage them: Termites slowly chew through a wall so others re-route through the hole; a Ram Crew of 4 smashes a wall or tower in one hit and slows as carriers die; the Sapper runs to the nearest wall and blows up himself and the wall.

**Blocked by:** 11 (Turnstile, Lighthouse, Siren), 12 (Balloonist, Shield Bro, Hype Man, Mole, Streaker)

**Status:** ready

**Touches:** battle/dudes, battle/pieces, catalog/dudes, maze

**Effort:** medium

- [ ] Pieces have health; only Wall-breakers (and later bosses) reduce it
- [ ] Wall-breakers follow a second direction field where blocking Pieces are passable at a high cost, so they head for the wall that matters
- [ ] A destroyed Piece is removed, the route is recomputed, and a Piece-destroyed event is emitted for Attack gold
- [ ] Termite chews over time; Ram Crew hits once per cooldown and slows as its 4 carriers die; Sapper destroys the nearest wall and himself
- [ ] Sapper is marked as an Unlock in the catalog
- [ ] One battle test per Wall-breaker, plus a test that other Dudes re-route through a new hole
