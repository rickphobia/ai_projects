# 02: The World seen from the Runway

**What to build:** the player sees the World in 3D as ASCII. The Cockpit view shows the hand-made World (hills, the lake, the Airport and its Runway) from a fixed camera sitting on the Runway, drawn with the Character ramp, with the top of the nose cowling and the window frame drawn over it. Nothing moves yet. This proves decision 0001 (three.js renders, we pick the characters) before anything is built on it.

**Blocked by:** 01 (Walking skeleton)

**Status:** ready

**Touches:** world, adapters/view, screen, entrypoint, smoke test

**Effort:** medium

- [ ] The World is defined as data in the Game core: ground height and surface type (runway, grass, hill, lake) at any point in a roughly 20×20 km area
- [ ] The three.js view adapter builds its scene from that same World data, renders from a given camera pose into a hidden target with one pixel per character cell of the view area, and returns a brightness grid
- [ ] Draw turns a brightness grid into characters from the Character ramp ` .:-=+*#%@` and lays the cowling and window frame over the view; the Screen is always 45 lines of 120 characters in the range 32–126
- [ ] Unit tests: a uniform brightness grid gives the expected ramp character; darkest gives a space, brightest gives `@`; the frame is in place; the World reports the right surface type at the Runway, the lake and a hill
- [ ] If WebGL is missing or three.js fails to start, the Screen shows a plain ASCII message saying so and the error is logged
- [ ] A Playwright smoke test loads the built page and checks the Screen is 45 lines of 120 characters with the view area not blank; it runs in CI
- [ ] On the preview, the Runway, the lake and the hills are recognisable
