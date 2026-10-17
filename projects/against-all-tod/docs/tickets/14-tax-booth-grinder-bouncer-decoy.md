# 14: Tax Booth, Grinder, Bouncer, Decoy Goal

**What to build:** The remaining defense Pieces work: the Tax Booth moves some Attack gold into Defense gold for every Dude that crosses it; the Grinder instantly kills small Dudes, pays double and jams for 3 seconds; the Bouncer throws the first Dude it touches back to the Spawn line; Dudes go for the Decoy Goal first until it breaks.

**Blocked by:** 07 (Two wallets and the shop), 13 (Wall-breakers)

**Status:** ready

**Touches:** battle/pieces, catalog/pieces, economy, renderer/pieces

**Effort:** low

- [ ] Tax Booth and Grinder are walkable floor Pieces; Bouncer and Decoy Goal block
- [ ] Tax Booth transfer goes through the economy rules
- [ ] Grinder kills small kinds (Intern, Termite, Streaker) instantly with double kill gold, damages others heavily, and jams for 3 s after each kill
- [ ] Bouncer throws a Dude back to the Spawn line on a cooldown
- [ ] Dudes route to the Decoy Goal first; Dudes reaching it vanish and earn no Attack gold
- [ ] Bouncer and Decoy Goal are marked as Unlocks in the catalog
- [ ] One battle or economy test per Piece
