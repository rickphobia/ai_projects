# 34: Rename, move and new folder

**What to build:** Long-pressing a folder in the tree offers New folder, Rename and Move to…; long-pressing a Document offers Rename and Move to…. Move to… shows a folder picker. Renaming or moving a Document carries its Ink file, `.assets` and Versions along; a name clash refuses the whole operation with a message, and nothing is ever overwritten. A Document open in a Tab is saved first and its Tabs and Recent Documents follow the new name. There is no Delete (stories 15–20). Spec: `docs/specs/milestones-3-4.md`

**Blocked by:** 29 (Tabs in one Pane)

**Status:** ready

**Touches:** core-studyfolder, core-layout, app-home

**Effort:** medium

- [ ] Study folder: rename and move a Document carry every companion; a clash on the PDF or any companion refuses with nothing moved; a failure halfway moves everything back (tested)
- [ ] Study folder: new folder, folder rename and move; moving a folder into itself is refused (tested)
- [ ] Layout and Recent Documents follow a renamed or moved Document (tested)
- [ ] Long-press menus and the Move to… folder picker in the home tree
- [ ] An open Document is saved before it is renamed or moved, and keeps working after
- [ ] Each operation is logged with its result and the step that failed, file names only
- [ ] On-tablet check written in the PR: on a copy of the Study folder, rename a Document with ink and Pictures, move it to another course, reopen it with everything there
