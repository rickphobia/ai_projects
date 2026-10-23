# 23: Redo

**What to build:** In Review, a Mistake's front has a blank writing area under it where I write my **Redo** with the pen (optional). After Show answer the Redo stays visible beside the back. Every Redo is kept with its Entry as strokes and listed on the Entry screen. Spec: `docs/specs/revision-log-and-polish.md`.

**Blocked by:** 22 (Review, Anki style)

**Status:** done

**Touches:** core-revisionlog, app-revisionlog, app-ink

**Effort:** low

- [x] Redo strokes round-trip exactly through the Revision log, packed like Ink file points (tested)
- [x] The writing area uses the same low-latency pen as Documents; Key points have no writing area
- [x] The Redo stays visible after Show answer
- [x] Earlier Redos are listed on the Entry screen with their dates
- [x] On-tablet check written in the PR: write a Redo, rate it, find it on the Entry screen
