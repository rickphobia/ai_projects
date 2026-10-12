# ASCII Sky

A browser flight simulator where everything on screen, the 3D world included, is drawn with printable ASCII characters in one colour.

## Flying

**Plane**:
The single light propeller aircraft the player flies, modelled on a Cessna 172.
_Avoid_: aircraft, jet, ship

**Flight**:
One attempt from standing on the Runway to Landed or Crashed.
_Avoid_: game, run, session

**Free flight**:
Flying with no goal, score or timer. The only way to play in v1.
_Avoid_: sandbox, challenge, mission

**Stall**:
The moment the wings stop making enough lift because the Plane is too slow or pitched too high, so the nose drops.

**Touchdown**:
The moment the Plane's wheels first meet the ground after being airborne. Whether it was gentle decides how the Flight ends.

**Landed**:
The end of a Flight where the Touchdown was gentle (low sink rate, wings near level, nose not down) on the Runway and the Plane rolled to a stop.

**Landed off-runway**:
Like Landed, but the gentle Touchdown was on flat grass instead of the Runway.

**Crashed**:
The end of a Flight where the Touchdown was too hard, or the Plane hit a hill or the lake.
_Avoid_: dead, game over

**Touchdown stats**:
The numbers shown when a Flight ends: sink rate, speed, bank and distance from the Runway centreline at Touchdown.

## World

**World**:
The one fixed, hand-made area the Plane flies in: hills, a lake and the Airport, with an edge the Plane cannot pass.
_Avoid_: map, level, terrain

**Airport**:
The only place in the World built for the Plane, with one Runway.

**Runway**:
The strip at the Airport where every Flight starts and the only place a Flight can end Landed.

## Screen

**Screen**:
The fixed grid of characters everything is drawn into, scaled to fit the browser window.
_Avoid_: canvas, terminal, display

**Cockpit view**:
The default view: the World seen from the pilot's seat, above the Instrument panel.

**Outside view**:
The World seen from behind the Plane, with the Plane itself drawn in characters.
_Avoid_: chase cam, external view

**Instrument panel**:
The strip at the bottom of the Screen showing the six flight instruments plus RPM, throttle, flaps, brakes and the stall warning.
_Avoid_: HUD, dashboard

**Character ramp**:
The ordered list of characters, from sparse to dense (` .:-=+*#%@`), used to show how bright a surface is.
_Avoid_: palette, shading
