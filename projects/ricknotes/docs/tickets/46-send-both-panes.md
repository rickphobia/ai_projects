# 46: Send both Panes

**What to build:** When the two Panes show two different PDFs, Send to asks This Document or Both Panes (naming both Documents). Both Panes shares the two PDFs in one share to the Gemini or Claude app, with the chosen Preset's prompt on the clipboard, falling back to the full share menu when the app isn't installed. Every direct send, of one Document or both, opens the AI app in split screen beside RickNotes where the tablet allows it, and full screen otherwise. New Presets files get the "Overview with tutorial" Preset, and the README gives it for pasting into an existing file. Spec: `docs/specs/send-both-panes.md`

**Blocked by:** None (can start immediately)

**Status:** done

**Touches:** core-layout, core-presets, app-share, app-viewer

**Effort:** low

**Owner steps:** the on-tablet check below in the Preview app, then paste "Overview with tutorial" from the README into `_ricknotes/presets.json` on the laptop.

- [x] The Layout gives the other Pane's Document only when two Panes show different Documents and the other isn't missing (tested)
- [x] A new Presets file has "Overview with tutorial", ink off (tested)
- [x] Send to shows This Document / Both Panes only in that case, This Document selected each time it opens
- [x] Both Panes sends both PDFs in one share, the Document Send to was opened from first, readable only by the app it goes to
- [x] Direct sends open the AI app beside RickNotes, and still open full screen where the tablet doesn't split
- [x] Logs the target, the Preset name and the number of Documents, never the prompt or names
- [x] README: Send to describes Both Panes and split screen, and gives the "Overview with tutorial" JSON to paste
- [x] On-tablet check written in the PR: lecture and tutorial in two Panes, Both Panes → Gemini → Overview with tutorial, paste: both PDFs are in a new chat beside RickNotes; the same to Claude; with one Pane, no Both Panes choice
