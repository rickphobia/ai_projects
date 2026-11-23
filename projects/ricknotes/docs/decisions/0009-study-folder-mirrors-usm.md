# The Study folder mirrors chosen course folders of Drive `usm/`, one pair each, deletions off

The Study folder was a separate `RickNotes Study` folder that a `~/ee` job filled with renamed copies of PDFs from Drive `usm/`, so every PDF existed twice. Now the tablet's Study folder mirrors Drive `usm/` at the same paths, with one two-way FolderSync pair per Course folder I study and Sync deletions off. FolderSync does the choosing because it needs no app code, and storage is no constraint. Deletions stay off because the seniors' material on Drive is also mirrored to the laptop, and FolderSync warns that a missing local folder with deletions on can delete the cloud side. Spec: `docs/specs/one-study-folder.md`. (Number 0008 is kept for the Export decision that `docs/specs/export-with-ink.md` names.)

**Deletions are now on:** decision [0010](0010-sync-deletions-on.md) replaces the deletions part of this record.

**Trade-offs:** a rename or move on either side likely leaves a duplicate instead of following through, so files in a paired course aren't renamed, and RickNotes' own Rename and Move… make duplicates there. Anything outside a Course folder, apart from the Presets file's own pair, stays on the tablet only. Each new course is one more pair to set up by hand.
