# 38: Send to with Presets

**What to build:** Each Document has Send to with the Gemini app and the Claude app as targets. Choosing a **Preset** puts its prompt on the clipboard and shares the PDF to that app. Presets live in `_ricknotes/presets.json` in the Study folder, written with the main spec's Default Presets the first time and never overwritten after; a broken file falls back to the defaults and says what is wrong. Presets marked ink on say "(ink comes with export)" until milestone 6. The tree hides `_ricknotes` (stories 29–33). Spec: `docs/specs/milestones-3-4.md`

**Blocked by:** None (can start immediately)

**Status:** done

**Touches:** core-presets, app-share, app-viewer

**Effort:** low

**Owner steps:** the on-tablet check below, then record in the README ("How each app receives a shared PDF") what the Gemini and Claude apps did with the PDF.

- [x] Presets: defaults written once; an existing file is never overwritten; a broken file falls back with a clear reason (tested)
- [x] Send to in the Document toolbar with a Preset choice; the prompt is on the clipboard before the share
- [x] The share goes to the Gemini or Claude app when installed, otherwise the full share menu
- [ ] README records how each app receives a shared PDF (placeholder in the README until the tablet check)
- [x] Logs the target and Preset name, never the prompt
- [ ] On-tablet check written in the PR: send a tutorial to Claude with Answer only, paste the prompt, see the PDF attached
