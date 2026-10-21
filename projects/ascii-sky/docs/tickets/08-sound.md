# 08: Sound

**What to build:** the player hears the Plane. An engine tone rises and falls with RPM, and a stall horn sounds while the Plane is in a Stall. Sound starts with the key press that leaves the title screen and goes silent while paused.

**Blocked by:** 07 (Ending a Flight)

**Status:** done

**Touches:** adapters/audio, entrypoint

**Effort:** low

**Owner steps:** listen on the preview: the engine tone and the stall horn are audible and change as expected.

- [x] A WebAudio adapter plays an engine tone whose pitch and volume follow RPM, generated in code with no audio files
- [x] A stall horn plays while the Stall flag is set
- [x] Audio starts on the first key press (browser autoplay rules) and is silent while paused and after a Flight ends
- [x] Unit tests for the mapping from game state to tone settings (pitch, volume, horn on or off), with WebAudio faked
- [ ] On the preview, the engine tone and the stall horn are audible and change as expected
