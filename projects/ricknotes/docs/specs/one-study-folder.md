# RickNotes — One Study folder

Owner: @rickphobia · 2026-11-17 · Grilled 17 Nov 2026. Words in **bold** on first use are defined in `GLOSSARY.md`. RickNotes is parked this semester (owner's call, 10 Nov 2026), and this plan needs no app code; most of its steps happen on the tablet, in `~/ee` and in `~/homelab`.

## Problem Statement

My course material lives on Drive in `usm/`: `Year N/Sem N/<CODE name>/` holds the seniors' material by type (`Past Year Papers/`, `Notes & Slides/`, `Tutorials/`, `Tests & Quizzes/`, `Labs/`, `Assignments & Projects/`, `Other/`) and my own `_My class 2026-27/` (`eLearning/`, `answer packs/`, `Assessment records/`). The tablet's **Study folder** is a separate FolderSync pair with Drive `usm/RickNotes Study/`, which a daily job in `~/ee` (`ricknotes_file.py`) fills by copying chosen files out of `usm/` under new names (`<course>/{Slides,Tutorial,Answer pack,Test}`). So every PDF in it exists twice on Drive, the seniors' Past Year Papers and most of Notes & Slides never reach the tablet, and two more `~/ee` tools (chapter notes, revision guides) write only into `RickNotes Study`, so those files have no home in `usm/`.

## Solution

- **One folder.** The tablet keeps a `usm` folder on its own storage that mirrors the course folders I choose from Drive `usm/`, at the same paths. RickNotes' Study folder is that folder.
- **FolderSync does the choosing.** One two-way folder pair per **Course folder**, so the tablet holds only the courses I pair, and RickNotes shows everything it finds, as today.
- **Deletes, renames and moves follow through.** The pairs sync deletions and FolderSync signs in as yeapmagrick, so nothing comes back as a duplicate, while the seniors' archive, which yeapmagrick doesn't own, can't lose a file to the tablet (decision 0010).
- **A nightly copy of what only I wrote.** The Beelink copies every Ink file, `.assets` folder, Revision log and the Presets file off Drive each night into dated folders.
- **The copy job goes.** `~/ee` writes its own files straight into the course folders in `usm/`, Office files in the paired courses get a PDF beside them, and `ricknotes_file.py` and the `RickNotes Study` folder are retired.

## User Stories

1. As a student, I want the tablet to hold the course folders I choose from Drive `usm/` at the same paths, so that every PDF exists once on Drive and I find it where I filed it.
2. As a student, I want to add a course by adding one FolderSync pair, so that choosing what's on the tablet needs no app change.
3. As a student, I want to leave out part of a course (say `Labs/`) with a FolderSync exclude filter on its pair, so that I can trim a course without unpairing it.
4. As a student, I want `Year N/Sem N/<CODE name>` to still be a Course folder in RickNotes, so that each course keeps its own Revision log without marking anything by hand.
5. As a student, I want a delete on the tablet never to reach Drive, so that a slip on the tablet can't remove the seniors' material from Drive or my laptop.
6. As a student, I want my ink, Pictures and Revision logs to sync two ways with Drive beside their PDFs, so that they are backed up as today.
7. As a student, I want my Presets file to sync too, although it sits outside every Course folder, so that it survives a reinstall.
8. As a student, I want a nightly copy of my Ink files, `.assets`, Revision logs and Presets off Drive, kept for 30 days, so that a mistake made on Drive itself (a folder deleted on the laptop) can be undone.
9. As a student, I want chapter notes, revision guides and finished answer packs to land in the course's `_My class 2026-27/` folder on Drive, so that they reach the tablet with no copy job.
10. As a student, I want answer packs that still need review, and preview packs, kept off the tablet, so that I never study from an unchecked key.
11. As a student, I want every Office file in a paired course to have a PDF beside it, so that the seniors' slides open in RickNotes.
12. As a student, I want the old `RickNotes Study` folder retired only after the new pairs are checked, so that nothing I use disappears early.

## Implementation Decisions

### Layout

- The rclone remote `usmdrive:` on the Beelink is rooted at Drive `usm/`; paths here are relative to it.
- On the tablet, a folder named `usm` on internal storage holds the pairs' local sides at the same relative paths: `usm/Year 1/Sem 1/EEE105 Circuit Theory/` ↔ Drive `usm/Year 1/Sem 1/EEE105 Circuit Theory/`. RickNotes' Study folder is that `usm` folder ("Change folder" in Settings). It stays on internal storage; RickNotes refuses an SD card.
- Folders three levels in are Course folders (`CourseFolders.COURSE_DEPTH`), which matches `Year N/Sem N/<CODE name>`. *(24 Nov 2026: the tablet uses short `y1s1/<course>` folders, so it is now two levels; decision 0011.)* Folders deeper in a course (`_My class 2026-27/eLearning/`) belong to that course, as today.

### Choosing what's on the tablet: one pair per Course folder

- Each course I study gets its own two-way pair. Starting set (17 Nov 2026): EBB113, EEE105, EMM101 and EUM113 in `Year 1/Sem 1`, about 3.0 GB together. EEE123 holds code repos and isn't paired. A new course is a copy of an existing pair (FolderSync's Copy) with its two folders changed.
- **Rejected: one pair on `usm/` with include filters.** FolderSync's V2 filters (docs, checked 17 Nov 2026) sync a subfolder of an included folder only if it also matches an include filter, and only if its parent folders do too, so each course needs a "Folder path RegEx" covering `Year 1`, `Year 1/Sem 1` and every folder below the course. It's fragile and hard to read.
- **Rejected: sync a whole semester and hide folders in RickNotes.** It needs a new setting in a parked app, and storage is no constraint (the owner puts the tablet at about 256 GB), so it gains only toggling what's shown without opening FolderSync.

### Pair settings

Every pair, course pairs and the Presets pair alike:

1. **Sync type:** two-way.
2. **Schedule:** every 15 minutes, with **instant sync** on.
3. **Sync deletions:** on, with the Drive account signed in as yeapmagrick (decision 0010; step 2's results are in the README's behaviour table).
4. **Conflicts:** as in the README today (rename the oldest file, so both are kept; never an overwrite option).
5. **Filters:** exclude the file extensions `.tmp` and `.del` (the tablet's file manager trash) and the folders `.versions` and `needs review` (story 10).

Plus one small pair for the Presets file: tablet `usm/_ricknotes` ↔ Drive `usm/_ricknotes`. Anything else outside a Course folder (a Notebook or dropped PDF at the top of the tree) stays on the tablet only, so the README's rule is: Notebooks and dropped PDFs go inside a Course folder.

### Renames and moves

- With Sync deletions on, a rename or move on either side follows through, with no duplicate (step 2, 23–24 Nov 2026). RickNotes' own Rename and Move… work in a paired folder.
- **Rejected: Sync deletions off.** Step 2 showed every delete, rename and move coming back as a duplicate, and a Conflict copy resolved with Keep mine coming back from Drive on every sync. The risk of deletions on, an emptied tablet folder deleting yeapmagrick's files on Drive, is covered by the guards in decision 0010.

### Where RickNotes' own files live

- Ink files and `.assets` beside each PDF, `_revision_log/` and `<course> revision log.pdf` in each Course folder, and Notebooks where they are made all land inside `usm/` on Drive and on the laptop's mirror. This is decision 0003 applied to the new folder. `.versions` stays on the tablet (filtered). Drive `usm/` is shared only with the owner's second account (checked 17 Nov 2026).

### What doesn't change in the app, and migration

- RickNotes needs no code change. Recent Documents, Layout Tabs, Course folder marks and each Entry's Document path are relative to the Study folder; reading positions are keyed by the PDF's absolute path, so they start fresh after Change folder.
- Nothing to migrate: on 17 Nov 2026 Drive held no Ink file, `.assets` or `_revision_log` anywhere under `usm/`, Trash included (the owner reads and writes in Nebo this semester). If ink is written in the old folder before the cut-over, it moves by hand with its PDF; the old folder's names differ from the sources', so it would then show as **Orphaned ink** until linked.

### `~/ee`: writers into `usm/` and the copy job retired

- Chapter notes go to `<course>/_My class 2026-27/notes/`, revision guides to `<course>/_My class 2026-27/revision/`, both on Drive `usm/`, not `RickNotes Study`.
- Answer packs that still need review, and preview packs (`(PREVIEW)` in the name, like `EMM101 Tutorial 8 answer pack (PREVIEW).pdf`, which sits in `answer packs/` on 17 Nov 2026), go to `<course>/_My class 2026-27/answer packs/needs review/`, which every pair excludes; a finished pack goes to `answer packs/` as now. This replaces the copy job's registry check and its `pack_skip_words`, the only things that hold such packs back today.
- The copy job's other `skip_words` ("solution", "teaching plan", "lesson plan" …) stop applying: the seniors' worked solutions and lesson plans in a paired course reach the tablet. That is wanted; a pair's exclude filter trims anything that isn't.
- `chapter_notes.py` removes an earlier set of notes PDFs when a deck's set changes. On Drive that is a delete, which the pairs now carry to the tablet, so the old set leaves the tablet too.
- `ricknotes_file.py` leaves the daily job once the pairs are live. `~/ee` open item 6 (eLearning PDFs reach RickNotes) closes, since `eLearning/` is inside the paired course folder; open item 7 (renaming `_My class` files into chapter folders) is dropped.

### `~/ee`: Office files to PDF

- In paired courses only: each `.ppt`, `.pptx`, `.doc` and `.docx` gets `<same name>.pdf` beside it, made on the Beelink with LibreOffice (decision 0006, `slides_to_pdf.py`). Never overwrite: a taken name is skipped and logged. The original is never touched. About 63 such files in the four courses on 17 Nov 2026, some in `eLearning/` that may already have their PDF.
- One batch now, then a daily step in the existing daily job for new files. A newly paired course is added to its list.

### `~/homelab`: the nightly copy

- A systemd user timer on the Beelink runs `rclone copy` (never `sync`) from `usmdrive:` with only `*.ink.json`, `*.assets/**`, `_revision_log/**` and `_ricknotes/**`, into a new dated folder each night, keeping the newest 30. It's a few MB. A failed run says so in its log and alerts like the other Beelink timers.
- With Drive's version history (an overwritten Ink file) and Drive's Trash (a deleted one), this covers the case neither does: a wrong change made on Drive itself.
- **No in-app backup.** RickNotes' Versions already cover the tablet, and the nightly copy covers Drive, so an in-app feature would add nothing but code to a parked app.

## Plan

In this order. Steps 3 and 4 can run side by side.

| # | Where | Who | What | Check |
|---|---|---|---|---|
| 1 | `ai_projects` | This PR | This spec and decision record 0009 | Owner reads and merges |
| 2 | Tablet | Owner, about 20 min | A throwaway pair (`usm/_sync test` ↔ Drive `usm/_sync test`) with the settings above: delete a file on the tablet; delete one on Drive; rename one on Drive; Move… one in RickNotes; force a Conflict copy and pick Keep mine; put a PDF in a `needs review` subfolder on Drive | Each result recorded in RickNotes' README, and the `needs review` PDF never reaches the tablet. If deletes or a Kept-mine Conflict copy come back where they shouldn't, the rule comes back for grilling before step 5 |
| 3 | `~/ee` | `~/ee` session | Writers into `_My class 2026-27/notes/`, `revision/` and `answer packs/needs review/` (preview packs too), with their tests; chapter notes' removal of old sets follows step 2's result | The next daily run puts new files there and none in `RickNotes Study` |
| 4 | `~/ee` | `~/ee` session | Office files to PDF: the batch and the daily step | EMM101's `.pptx` slides open as PDFs in RickNotes on the tablet |
| 5 | Tablet, then `ai_projects` | Owner, about 30 min, then a RickNotes ticket | The four course pairs and the Presets pair; RickNotes "Change folder" to `usm`. The ticket rewrites the README's "Sync app" section (pairs, settings, rename rule, where Notebooks go) and the Study folder line in `GLOSSARY.md` | The tree shows the four Course folders; ink written on one PDF reaches Drive `usm/` within 15 minutes |
| 6 | `~/homelab` | Homelab session | The nightly copy timer | The morning after step 5, the newest dated folder holds that Ink file, and restoring it by hand works |
| 7 | `~/ee` | `~/ee` session | `ricknotes_file.py` out of the daily job; item 6 closed and item 7 dropped, with `history.md` entries | The daily job runs green without it |
| 8 | Tablet and Drive | Owner, by hand | Remove the old pair, move `RickNotes Study` to Drive's Trash, delete the tablet's copy | Neither RickNotes nor Nebo uses the old folder |

- **Only step 5's README part is a RickNotes ticket** (ticket 47). Steps 2, 5 and 8 are owner steps a session can't do, so they are its Owner steps, and the README's FolderSync behaviour table waits for step 2's results.
- Steps 3, 4, 6 and 7 are done in sessions in `~/ee` and `~/homelab`, each pointing back to this spec.

## Testing Decisions

- No RickNotes code changes, so no new unit tests here. The checks in the plan are run on the tablet and on Drive.
- The `~/ee` and `~/homelab` scripts get their own tests in their repos, with Drive faked; a dry run shows what a real run would copy or convert before it does.

## Out of Scope

- A "shown folders" setting or Hide folder in RickNotes.
- An in-app backup or restore screen.
- Pairs for Years 2 to 4, and Office conversion outside paired courses.
- Renaming or reorganising the seniors' material.
- Switching from Nebo to RickNotes: a separate, later decision, once RickNotes is good enough to replace it.
- EEE123's code repos.

## Further Notes

- **Checked in step 2 (23–24 Nov 2026):** the README's behaviour table. FolderSync's deletes on Drive go to the signed-in account's Trash. **Not needed by this plan, unverified:** whether pairs can overlap under one local folder, whether the free app limits the number of pairs.
- FolderSync facts above are from its docs (checked 17 Nov 2026): https://foldersync.io/docs/help/v2/filters, https://foldersync.io/docs/help/v2/folderpairsettings/ and, for the deletions warning, https://foldersync.io/docs/help/folderpairsettings/. A second check with Gemini didn't run (it timed out).
- Sizes and counts are from `rclone lsf` of `usmdrive:` on 17 Nov 2026.
