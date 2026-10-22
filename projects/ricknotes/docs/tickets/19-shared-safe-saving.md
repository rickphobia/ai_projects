# 19: Prefactor: shared safe saving

**What to build:** Pull the safe write (temporary file then swap), Versions, and save scheduling (2 s after the last change, retry on failure, force on background) out of the Document session into a reusable piece in `core`, so the Revision log can save the same way without copying code. Nothing changes for the user. Spec: `docs/specs/revision-log-and-polish.md`.

**Blocked by:** None (can start immediately)

**Status:** ready

**Touches:** core-session

**Effort:** medium

- [ ] The safe write, Versions and save scheduling live in one reusable piece that the Document session uses
- [ ] All existing Document session tests pass unchanged (no test edited to make it pass)
- [ ] The reusable piece has its own tests for a failed save leaving the old file whole and for Version timing
- [ ] No user-visible change; the PR says so and lists what moved
