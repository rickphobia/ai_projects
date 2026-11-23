# 51: Presets send with ink

**What to build:** A Preset marked ink on sends an Export of the Document instead of the bare PDF; each Preset row says "with ink" or "no ink" in place of "(ink comes with export)". With Both Panes, each Document is exported with its own ink and both go in one share, in today's order. The send waits behind the same progress bar, and the prompt goes on the clipboard only once the Export is ready. A cancel or failure shares nothing and leaves the clipboard alone. On a Document whose Ink file can't be read, an ink-on Preset sends the bare PDF with a note that the ink was left out; one waiting on Keep mine or Keep the other asks for a pick first. Spec: `docs/specs/export-with-ink.md`, stories 11–15, 17 and 18.

**Blocked by:** 49 (Export with ink)

**Status:** ready

**Touches:** core-presets, app-share

**Effort:** low

**Owner steps:** the on-tablet check in the PR, in the Preview app.

- [ ] Ink on asks the Export plan for ink, ink off for none; Both Panes asks for one plan per Document (tested at the seam)
- [ ] Rows show "with ink" or "no ink"; "(ink comes with export)" is gone
- [ ] The prompt goes on the clipboard just before the share, never on a cancel or failure
- [ ] Both Panes exports into separate cache subfolders, so two same-named PDFs don't clash
- [ ] Ink unreadable sends the bare PDF with a note; Pick a side first sends nothing until a side is picked
- [ ] Logs the target, the Preset name, the number of Documents and whether ink went; never the prompt or names
- [ ] README: Send to describes ink on and ink off
- [ ] On-tablet check written in the PR: a tutorial with working sent to Claude with Hint arrives with the ink; Chapter overview (ink off) sends the bare PDF; Both Panes with an ink-on Preset sends both with their ink
