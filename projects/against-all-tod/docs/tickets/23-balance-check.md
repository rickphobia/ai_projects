# 23: Balance check and first tuning pass

**What to build:** A headless balance check plays seeded scripted Runs with simple fixed strategies to Round 10, so a tuning change that makes one side unbeatable fails CI. The first tuning pass adjusts catalog numbers until both sides can win.

**Blocked by:** 22 (Unlocks and first-Run hints)

**Status:** ready

**Touches:** tests/balance, catalog/tuning

**Effort:** medium

- [ ] Balance tests play several seeds with simple strategies for both sides, headless
- [ ] They check bounds (e.g. a basic Army breaks a basic Maze within N Rounds, a basic Maze holds a basic Army at least once), not exact numbers
- [ ] Catalog numbers tuned so the checks pass; changes listed in the PR
- [ ] Balance tests run in CI within a reasonable time
