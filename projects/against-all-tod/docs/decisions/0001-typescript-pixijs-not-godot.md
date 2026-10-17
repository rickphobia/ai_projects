# Browser demo in TypeScript + PixiJS, not Godot

The game is meant for Steam if the browser demo proves it is fun, so an engine with native desktop export (Godot 4, as `my-piggy` uses) was the obvious pick. We chose TypeScript, Vite and PixiJS instead: the demo is what decides whether a Steam version happens, so it must load fast on the web (a few MB instead of Godot's 30–40 MB), get a `▶ Try this version` Artifact link on every PR, and keep hundreds of Dudes routing through the Maze smooth, where JavaScript outruns GDScript. Steam comes later by wrapping the same build in Electron, as Vampire Survivors first shipped.

**Trade-offs:** Steam needs a desktop wrapper and a Steamworks binding instead of native export; we hand-build what an engine gives for free (scene tree, input mapping, audio buses).

**Considered Options:** Godot 4 (native Steam export, same toolchain as `my-piggy`, but a large web download and no Artifact previews).
