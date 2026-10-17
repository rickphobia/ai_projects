# 10: Round report

**What to build:** After every battle a Round report shows Goal damage, kills per Piece, where Dudes died on the Board, and where each wallet's gold came from, so the player knows why they won or lost.

**Blocked by:** 05 (Hundreds of Dudes stay smooth), 07 (Two wallets and the shop)

**Status:** ready

**Touches:** ui/report, battle/events

**Effort:** low

- [ ] Battle events carry what the report needs (which Piece killed, death tile)
- [ ] Report shows Goal damage, kills per Piece, a heat map of deaths and a gold breakdown per wallet
- [ ] Report is shown after wins and losses, and closed with one click or tap
- [ ] Tests: building the report data from a hand-made event list
- [ ] Screenshot in the PR
