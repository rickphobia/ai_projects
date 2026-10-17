# 17: Volume trick, real sound and sound effects

**What to build:** The Volume slider joins the Settings menu: down makes Dudes invisible until 2 tiles from a tower and really quiets the game; up makes Sirens reach further. The pause menu has an honest "Actual volume (we promise)" slider. The game plays Kenney sounds for shots, deaths, gold and the Goal.

**Blocked by:** 13 (Wall-breakers), 16 (Brightness and Game speed tricks)

**Status:** ready

**Touches:** tricks, battle/tricks, adapters/audio, assets/sounds, ui/settings, ui/pause

**Effort:** low

- [ ] Volume slider follows the same pricing rules as the other sliders
- [ ] Volume down: towers can't target Dudes further than 2 tiles away, per the catalog's per-step values
- [ ] Siren range and Hype Man boost read the Volume level
- [ ] Audio adapter plays at actual volume × Volume trick level
- [ ] Pause menu has the "Actual volume (we promise)" slider, saved with the Run's settings
- [ ] Kenney sounds for shots, kills, gold, Goal hits and Round end
- [ ] Tests: Volume step effects in battle; final audio level calculation
