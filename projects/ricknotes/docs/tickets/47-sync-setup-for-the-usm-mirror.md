# 47: Sync setup for the `usm` mirror

**What to build:** The README's FolderSync setup describes the new layout, so the owner can set up the tablet from it. The Study folder is a `usm` folder on the tablet's own storage. Each Course folder the owner studies has its own two-way pair with Drive `usm/` at the same path, plus one pair for `_ricknotes`. The README gives each pair's settings: two-way, every 15 minutes with instant sync, Sync deletions off, conflicts kept as today, and filters for `.*.tmp`, `.versions` and folders named `needs review`. It states the rules: don't rename or move files inside a paired course (RickNotes' own Rename and Move… make duplicates there); Notebooks and dropped PDFs go inside a Course folder, or they stay on the tablet only. It adds a FolderSync behaviour table with the owner's throwaway-pair checks, each one "not yet checked" until the owner records the result. `GLOSSARY.md`'s Study folder entry says it mirrors chosen course folders of Drive `usm/`, and the README lists decision 0009. No app code changes. Spec: `docs/specs/one-study-folder.md`

**Blocked by:** None (can start immediately)

**Status:** ready

**Touches:** README

**Effort:** low

- [ ] README "Sync app": the `usm` mirror, one pair per Course folder plus `_ricknotes`, and each pair's settings as above
- [ ] README: the rename and move rule, and the Notebooks and dropped PDFs rule
- [ ] README: a FolderSync behaviour table for the spec's step 2 checks, each one "not yet checked": delete on the tablet, delete on Drive, rename on Drive, Move… in RickNotes, Keep mine on a Conflict copy, and a PDF in `needs review` on Drive
- [ ] README: a short cut-over list, in the spec's order: course pairs and the `_ricknotes` pair, "Change folder" to `usm`, then retiring the old `RickNotes Study` pair and folder by hand
- [ ] `GLOSSARY.md` Study folder entry updated; README Decisions lists 0009
- [ ] The README's Status paragraph says nothing that contradicts the new setup

**Owner steps:** the spec's step 2 (the throwaway pair on the tablet), with each result written into the README's behaviour table; then step 5 (the cut-over) and step 8 (retiring `RickNotes Study`) by hand.
