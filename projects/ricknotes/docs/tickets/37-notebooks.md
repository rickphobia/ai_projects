# 37: Notebooks

**What to build:** Long-pressing a folder offers New Notebook, which asks for a background and creates a one-page A4 portrait PDF with that background printed in. It goes in the long-pressed folder, or its `pnotes` folder when a Course folder has one, named `Notes <date>.pdf` (with `(2)`, `(3)` … when taken), and opens straight away with Rename at hand. "Add page" at the end of a Notebook adds an Inserted page with the same background (stories 22–24, 27). Spec: `docs/specs/milestones-3-4.md`

**Blocked by:** 34 (Rename, move and new folder), 36 (Inserted pages)

**Status:** ready

**Touches:** core-studyfolder, app-home, app-viewer

**Effort:** low

- [ ] Study folder: Notebook folder choice (`pnotes` in a Course folder) and name with clashes (tested)
- [ ] The Notebook PDF is written with Android's PDF writer through the safe copy, using the background constants from ticket 36
- [ ] New Notebook in the folder long-press menu opens the new Notebook
- [ ] Add page at the end of a Notebook
- [ ] On-tablet check written in the PR: make a dotted Notebook in a course, write, add two pages, open the PDF in another reader
