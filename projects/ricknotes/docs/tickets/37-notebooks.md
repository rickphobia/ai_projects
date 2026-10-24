# 37: Notebooks

**What to build:** Long-pressing a folder offers New Notebook, which asks for a background and creates a one-page A4 portrait PDF with that background printed in. It goes in the long-pressed folder, or its `pnotes` folder when a Course folder has one, named `Notes <date>.pdf` (with `(2)`, `(3)` … when taken), and opens straight away with Rename at hand. "Add page" at the end of a Notebook adds an Inserted page with the same background (stories 22–24, 27). Spec: `docs/specs/milestones-3-4.md`

**Blocked by:** 34 (Rename, move and new folder), 36 (Inserted pages)

**Status:** done

**Touches:** core-studyfolder, app-home, app-viewer

**Effort:** low

**Owner steps:** the on-tablet check in the Preview app (in the PR body).

- [x] Study folder: Notebook folder choice (`pnotes` in a Course folder) and name with clashes (tested)
- [x] The Notebook PDF is written with Android's PDF writer through the safe copy, using the background constants from ticket 36
- [x] New Notebook in the folder long-press menu opens the new Notebook
- [x] Add page at the end of a Notebook
- [x] On-tablet check written in the PR: make a dotted Notebook in a course, write, add two pages, open the PDF in another reader
