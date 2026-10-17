# 05: Hundreds of Dudes stay smooth

**What to build:** A battle with 500 Interns runs at 60 fps on a mid-range laptop and at least 30 fps on a mid-range phone, so the swarm the pitch promises is possible before more features build on the battle.

**Blocked by:** 03 (Watch a Defense turn)

**Status:** ready

**Touches:** battle/core, maze, renderer/units

**Effort:** medium

- [ ] A debug scene (`?debug=1&scene=swarm`) spawns 500 Interns against a sample Maze and shows fps
- [ ] Sprites are batched; per-step work avoids per-Dude allocations
- [ ] Tower targeting finds Dudes in range without checking every Dude against every tower
- [ ] Route recomputation happens only when the Maze changes
- [ ] Measured fps on a laptop and a phone reported in the PR
- [ ] Existing battle tests still pass unchanged
