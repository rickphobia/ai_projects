# 22: Unlocks and first-Run hints

**What to build:** Reaching Score milestones Unlocks new Pieces and Dude kinds for later Runs: Sapper (5), Bouncer (10), Mole (15), Decoy Goal (20), Streaker (25). The end screen shows the next Unlock and the Score it needs. A player's first Run shows one-line hints in Rounds 1–3.

**Blocked by:** 08 (Save, load and debug options), 21 (Boss Rounds)

**Status:** done

**Touches:** progress, run, catalog/pools, adapters/storage, ui/end-screen, ui/hints

**Effort:** low

- [x] Progress module tracks best Score and Unlocks; milestones come from the catalog
- [x] Crate and shop pools offer only Unlocked items
- [x] Unlocks, best Score and first-Run flag are saved and survive between Runs
- [x] End screen shows new Unlocks and the next one with its Score
- [x] Hints in Rounds 1, 2 and 3 of the first Run only: mazing, switching sides, the Settings menu
- [x] Tests: Unlocks earned by Score, pools gated, hints only on the first Run
