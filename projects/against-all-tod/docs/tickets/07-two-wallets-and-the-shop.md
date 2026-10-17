# 07: Two wallets and the shop

**What to build:** Defense gold and Attack gold are earned and spent separately. Defense earns per kill plus a bonus for Goal health left; attack earns per Dude reaching the Goal, per Dude alive when the Goal breaks and per Piece destroyed, with bigger Dude kinds worth more. A Rewind restores the gold and adds bonus gold. A shop lets the player buy items for the side being played.

**Blocked by:** 06 (The Run)

**Status:** ready

**Touches:** economy, run, ui/shop, ui/hud

**Effort:** low

- [ ] Economy turns battle events and end state into gold for each wallet using catalog numbers
- [ ] Each side can only spend its own wallet; buying refuses with a typed reason when gold is short
- [ ] Rewind restores both wallets to the start of the Round and adds the Rewind bonus
- [ ] Shop lists the items for the side being played with prices
- [ ] HUD shows both wallets
- [ ] Tests: each gold rule with a hand-made event list; wallets never mix; Rewind bonus
