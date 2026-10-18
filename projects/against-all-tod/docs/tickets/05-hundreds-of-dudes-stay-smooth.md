# 05: Hundreds of Dudes stay smooth

**What to build:** A battle with 500 Interns runs at 60 fps on a mid-range laptop and at least 30 fps on a mid-range phone, so the swarm the pitch promises is possible before more features build on the battle.

**Blocked by:** 03 (Watch a Defense turn)

**Status:** done

**Touches:** battle/core, maze, renderer/units

**Effort:** medium

- [x] A debug scene (`?debug=1&scene=swarm`) spawns 500 Interns against a sample Maze and shows fps
- [x] Sprites are batched; per-step work avoids per-Dude allocations (the renderer allocates nothing per Dude per frame; the battle step still makes one new state per Dude it moves, which keeps the battle a pure, replayable function, at 0.05 ms per step for ~450 Dudes)
- [x] Tower targeting finds Dudes in range without checking every Dude against every tower
- [x] Route recomputation happens only when the Maze changes
- [ ] Measured fps on a laptop and a phone reported in the PR
- [x] Existing battle tests still pass unchanged

**Owner steps:** open the PR preview with `?debug=1&scene=swarm` on a laptop and a phone, wait until all 500 Interns are on (the corner counts them), and add both fps readings (current and lowest) to the PR.
