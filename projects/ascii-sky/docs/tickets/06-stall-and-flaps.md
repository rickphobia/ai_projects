# 06: Stall and flaps

**What to build:** the Plane Stalls when it's too slow or the nose is too high: the nose drops and `[STALL]` shows on the Instrument panel. Lowering the nose and adding power recovers. `F` steps the flaps, which lower the Stall speed and add drag, so the player can fly a slow approach.

**Blocked by:** 05 (Instrument panel)

**Status:** ready

**Touches:** flight, screen

**Effort:** medium

- [ ] Lift falls away past a critical angle of attack and the Plane's nose drops; the Stall flag is set while this lasts
- [ ] Flaps have a few settings stepped by `F`; each lowers Stall speed and adds drag
- [ ] `[STALL]` appears on the panel only while the Stall flag is set
- [ ] Unit tests through Advance and Draw: pulling up at low speed sets the Stall flag; lowering the nose with power clears it; Stall speed is lower with flaps down; `[STALL]` appears only with the flag set
