# 09: Draft Crates

**What to build:** At the start of each Round the player opens a Draft Crate for the side being played: 3 random items, one taken for free. Defense crates hold Pieces; attack crates hold Squads and Mutations. The crate can be rerolled for gold.

**Blocked by:** 07 (Two wallets and the shop)

**Status:** ready

**Touches:** run, catalog/pools, ui/crate

**Effort:** low

- [ ] Crate offers 3 random items from the side's unlocked pool, using the seeded RNG
- [ ] Taking an item is free; the other two are discarded
- [ ] Reroll costs gold from the side's wallet, at a catalog price
- [ ] Run state holds the Army's Mutations list, so a picked Mutation is stored even before ticket 15 gives Mutations effects
- [ ] A Rewind gives back the same crate and pick
- [ ] Tests: crate size, pool per side, free pick, reroll price, Rewind keeps the crate
