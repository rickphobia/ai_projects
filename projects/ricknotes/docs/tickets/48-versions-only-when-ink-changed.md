# 48: Versions only when the ink changed, and Getting old ink back

**What to build:** Opening a Document no longer takes a Version when its Ink file is the same as the newest Version, so the 10 kept are 10 different moments. The README gets a section "Getting old ink back": Drive's Manage versions on the laptop first, the `.versions` folder on the tablet as the last resort. The read-only warning for a damaged Ink file points to that section, and the README lines promising a restore screen in milestone 6 are corrected. Spec: `docs/specs/export-with-ink.md`, stories 19–21.

**Blocked by:** None (can start immediately)

**Status:** done

**Touches:** core-session, README

**Effort:** low

**Owner steps:** before merging, the Drive check in the spec's Further Notes: write on a Document, wait for a sync, then open Manage versions on its `.ink.json` in Drive on the laptop. If Drive shows no history, don't merge: the Version list goes back for grilling.

- [x] Opening twice with no change takes one Version; opening after a change takes a second (tested)
- [x] The 15-minute Version while writing still comes (tested)
- [x] A skipped Version on open is logged at debug level
- [x] README "Getting old ink back": close the Document on the tablet; in Drive on a laptop, Manage versions on its `.ink.json`, download yesterday's, put it back over the Ink file; let FolderSync bring it down before opening. Last resort: copy a file from `.versions` over the Ink file on the tablet
- [x] The damaged-Ink-file warning names "Getting old ink back"
- [x] README no longer says a restore screen comes in milestone 6
- [x] On-tablet check written in the PR: open and close a Document three times without writing, and `.versions` gains no new file; write a stroke, reopen, and it gains one
