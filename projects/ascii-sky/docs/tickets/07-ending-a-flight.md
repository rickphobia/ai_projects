# 07: Ending a Flight

**What to build:** every Flight ends. A gentle Touchdown on the Runway followed by rolling to a stop ends Landed. A gentle Touchdown on flat grass ends Landed off-runway. A Touchdown that is too hard, too steeply banked or nose-down, or hitting a hill or the lake, ends Crashed. A big ASCII-art banner shows the result and the Touchdown stats, and `R` starts a new Flight on the Runway.

**Blocked by:** 06 (Stall and flaps)

**Status:** done

**Touches:** flight, world, screen, entrypoint

**Effort:** medium

- [x] Touchdown is detected; gentle means sink rate below about 3 m/s, bank below about 10° and nose not down (limits kept with the other tuning numbers)
- [x] Endings: Landed (gentle, Runway, rolled to a stop), Landed off-runway (gentle, grass), Crashed (anything else, or a hill or the lake)
- [x] Touchdown stats are recorded: sink rate, speed, bank and distance from the Runway centreline
- [x] Draw shows a LANDED, LANDED OFF-RUNWAY or CRASHED banner with the Touchdown stats in the ended phase
- [x] `R` after a Flight ends starts a fresh Flight on the Runway
- [x] Each Flight's end and its Touchdown stats are logged at `info`
- [x] Unit tests through Advance and Draw: a gentle wings-level Runway landing ends Landed with matching stats; the same at a 30° bank ends Crashed; a high sink rate ends Crashed; gentle on grass ends Landed off-runway; the lake and a hill end Crashed; `R` resets; each banner appears
