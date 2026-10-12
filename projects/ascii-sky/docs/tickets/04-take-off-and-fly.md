# 04: Take off and fly

**What to build:** the player can fly. On the Runway the Plane rolls forward under throttle, steers with the rudder, holds still with the brakes, and lifts off when fast enough. In the air the arrow keys pitch and roll it, a bank turns it, and the Cockpit view follows the Plane through the World. The Plane cannot pass the World's edge. There is no Instrument panel yet.

**Blocked by:** 03 (Title screen, keys and pause)

**Status:** ready

**Touches:** flight, entrypoint, adapters/view

**Effort:** medium

- [ ] A light-sim flight model for one Cessna-172-like Plane: lift from angle of attack, drag rising with speed, thrust from throttle, gravity, damped control responses, turning from bank
- [ ] On the ground: rolling friction, rudder steering and brakes
- [ ] Advance runs the model in fixed small steps, so the same controls over the same time give the same result whatever the frame lengths
- [ ] Tuning numbers live together in one place in the core
- [ ] The core exposes the cockpit camera pose; the view adapter places its camera from it every frame
- [ ] The Plane is held inside the World's edge
- [ ] Unit tests through Advance: full throttle on the Runway lifts off within a sensible distance; brakes on at idle stays put; holding a bank changes heading; the World's edge holds; results don't depend on frame lengths
- [ ] On the preview, taking off and flying a circuit feels plausible
