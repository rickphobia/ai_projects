# 12: Balloonist, Shield Bro, Hype Man, Mole, Streaker

**What to build:** Five Dude kinds work: Balloonists float straight over the Maze; Shield Bro's shield blocks shots for Dudes behind him; Hype Man speeds up nearby Dudes with a boost scaled by Volume; the Mole tunnels under 3 tiles of Maze once per battle; every tower in range shoots the Streaker first.

**Blocked by:** 05 (Hundreds of Dudes stay smooth)

**Status:** ready

**Touches:** battle/dudes, catalog/dudes, renderer/units

**Effort:** low

- [ ] Balloonist flies straight toward the Goal ignoring the Maze; only towers flagged as hitting air can target it
- [ ] Shield Bro's shield absorbs shots aimed at Dudes behind him until it breaks
- [ ] Hype Man's speed aura reads the Volume level (neutral until ticket 17)
- [ ] Mole goes underground for 3 tiles, can't be targeted there, and resurfaces
- [ ] Towers in range of a Streaker target it before anything else
- [ ] Mole and Streaker are marked as Unlocks in the catalog (Unlock gating arrives in ticket 22)
- [ ] One battle test per Dude kind
