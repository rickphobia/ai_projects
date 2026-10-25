# 39: Conflict copies and sync setup

**What to build:** Opening a Document whose Ink file has a **Conflict copy** shows a warning before the pen can write, with Keep mine and Keep the other. The copy not kept is moved into Versions, so no file is deleted. The README gets the FolderSync setup steps: two-way, every 15 minutes and when the app goes to the background, keep both on conflict, skip temporary files and `.versions` (stories 34–36). Spec: `docs/specs/milestones-3-4.md`

**Blocked by:** None (can start immediately)

**Status:** done

**Touches:** core-session, core-studyfolder, app-viewer, README

**Effort:** medium

**Owner steps:** on the tablet, set up FolderSync from the README, then make a real conflict (write on the tablet and edit the same Ink file's copy on Drive before a sync) and record FolderSync's exact conflict file name in the README if the ticket's guess was wrong.

- [x] `core` recognises FolderSync's conflict naming for Ink files, as recorded in the README (tested)
- [x] Keep mine moves the Conflict copy into Versions; Keep the other moves the current Ink file into Versions and puts the copy in its place through the safe write; no file is deleted (tested)
- [x] The warning shows on open and the pen can't write until a choice is made
- [x] README has the FolderSync setup steps
- [x] Logs which side was kept, file names only
