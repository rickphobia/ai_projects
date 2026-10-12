# 05: Instrument panel

**What to build:** the bottom of the Screen becomes the Instrument panel, drawn in characters: airspeed, attitude indicator, altimeter, turn coordinator, heading indicator and vertical speed, plus RPM, throttle, flaps position and brakes. The player can now fly by the numbers.

**Blocked by:** 04 (Take off and fly)

**Status:** ready

**Touches:** screen

**Effort:** low

- [ ] Draw renders all ten readouts from the game state in the bottom rows of the Screen, using printable ASCII only
- [ ] The attitude indicator shows both pitch and bank
- [ ] Unit tests through Draw: for a known state, each readout shows the expected value; the Screen stays 45 lines of 120 characters
- [ ] On the preview, the panel is readable while flying
