# 16: Brightness and Game speed tricks

**What to build:** The game's Settings menu opens with Brightness and Game speed sliders that change the battle. Each slider has a neutral middle and 2 steps each way: Brightness down shrinks tower range and darkens the Board; up dazzles and slows Dudes. Game speed up makes Dudes outrun tower turning; down gives towers extra shots. Every drag costs the current side's gold, double mid-battle, and double toward the middle.

**Blocked by:** 05 (Hundreds of Dudes stay smooth), 09 (Draft Crates)

**Status:** ready

**Touches:** tricks, battle/tricks, run, ui/settings, renderer/effects

**Effort:** medium

- [ ] Tricks module holds slider positions, knows which direction helps which side, and prices each drag from the catalog
- [ ] Drag prices: normal away from the middle, double toward the middle, double again mid-battle; paid from the wallet of the side being played
- [ ] Mid-battle drags are recorded as timed inputs so the battle stays reproducible from its seed
- [ ] Brightness down: tower range shrinks per step except Lighthouse and lit tiles; the Board really darkens and units keep glowing outlines
- [ ] Brightness up: Dudes slow per step
- [ ] Game speed changes Dude speed against tower turn and fire rate, separate from Watch speed
- [ ] Tests: prices in every case, wallet charged, each step's battle effect, determinism with a mid-battle drag
- [ ] Screenshot of the dark Board with outlines in the PR
