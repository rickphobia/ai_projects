# 11: Turnstile, Lighthouse, Siren

**What to build:** Three defense Pieces work: the Turnstile turns 90° every 5 seconds and flips the route; the Lighthouse's sweeping beam hurts Dudes, works in the dark and lights nearby tiles for other towers; the Siren stuns Dudes in range every few seconds, with range scaled by Volume.

**Blocked by:** 05 (Hundreds of Dudes stay smooth)

**Status:** ready

**Touches:** battle/pieces, catalog/pieces, maze, renderer/pieces

**Effort:** low

- [ ] Turnstile placement is legal only if the Goal stays reachable in both positions; Dudes re-route when it turns
- [ ] Lighthouse beam sweeps, damages Dudes it touches, ignores darkness and marks lit tiles (darkness itself arrives in ticket 16)
- [ ] Siren stuns Dudes in range on a cooldown; its range reads the Volume level (neutral until ticket 17)
- [ ] Lighthouse and Sniper Nest can target Balloonists; the Siren can't (flag in catalog)
- [ ] One battle test per Piece showing it does what its description says
