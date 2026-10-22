# 42: Settings in the open

**What to build:** The Settings menu (where the tricks are bought: brightness, game speed, volume, window size) is no longer hidden behind the small "Settings" button at the left of the board. On wide screens its controls sit in the open in a strip at the top, beside the status chips: each trick shows its icon, its current position and its price, and is used right there with no menu to open. Where the screen is too narrow for that (a phone in portrait), they collapse into a clearly labelled "⚙ Tricks & Settings" button in the top bar, never a bare icon. Anything that's only allowed between battles still says so. Requested by the owner on 2026-10-22: "even I forgot it exists". This ticket is the whole scope.

**Blocked by:** 39 (Clear gold and an Army count in the top bar)

**Status:** ready

**Touches:** ui/settings, ui/hud, ui/style

**Effort:** low

- [ ] At 1910×873 and 1280×720 every trick's control is visible at the top without opening anything, with its icon, position and price
- [ ] Buying or moving a trick works the same as from today's menu (existing settings tests stay green; add one if the controls move to new code)
- [ ] On a 390×844 phone they collapse into a labelled "⚙ Tricks & Settings" button in the top bar that opens the same controls
- [ ] The old left-hand Settings button is gone
- [ ] Screenshots in the PR at all three sizes
- [ ] Lint, type checks and tests pass
