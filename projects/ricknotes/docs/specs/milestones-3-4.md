# RickNotes — Split view, tree editing, Notebooks and Send to

Owner: @rickphobia · 2026-10-24 · Settles milestones 3 and 4 of `docs/spec.md` after their grilling. Words in **bold** on first use are defined in `GLOSSARY.md`. Where this file and the main spec's stories 53–73 differ, this file wins; see "Effect on the main spec" at the end.

## Problem Statement

The Revision log feature made RickNotes my daily app, but two gaps remain:

- **One Document at a time.** I work a tutorial while looking at the lecture, so I keep flipping between them, or use Android's split screen with a second reader that has none of my ink.
- **The Study folder can only be browsed.** New folders, renames and moves need a file manager (and leave my ink behind), I have nowhere to write that isn't an existing PDF, I can't add blank pages for long working, and handing a Document to Gemini or Claude means re-typing my instructions.

## Solution

- **Split view (milestone 4, built first).** Up to two **Panes**, each with **Tabs**, like VS Code. The split button opens the current Document in the other Pane; a tree drawer opens any Document into a Pane; the layout comes back after a restart.
- **Tree editing.** Long-press a row for New folder, New Notebook, Rename and Move to…. A Document's ink, Pictures and Versions travel with it. There is no Delete.
- **Notebooks and inserted pages.** A new one-page lined, grid, dotted or blank A4 PDF, and blank pages inserted between any Document's pages.
- **Send to.** Share a Document to the Gemini or Claude app with a **Preset** prompt on the clipboard.
- **Safe with sync.** Conflict copies are caught and resolved by choice, Orphaned ink can be linked back, and the README has the FolderSync setup.

## Build order

1. Milestone 4, split view: stories 1–14.
2. The rest of milestone 3: stories 15–36.

Milestone 4 needs nothing from milestone 3. Each milestone's "done when" test in the main spec is still its gate.

## User Stories

### Panes and Tabs (milestone 4)

1. As a student, I want a split button in the toolbar, and Ctrl+\ on a keyboard, to open the current Document in a second Pane at the same page, so that I see the lecture and the tutorial side by side.
2. As a student, I want at most two Panes, side by side in landscape and stacked in portrait, so that each PDF stays big enough to read on the tablet.
3. As a student, I want Tabs in each Pane with no limit, the tab bar scrolling when it is full, so that I keep a whole chapter's Documents open.
4. As a student, I want the Pane I last touched to be the **Focused Pane**, shown subtly, so that I know where a Document I open will go.
5. As a student, I want a tree drawer in the Document screen where tapping a Document opens it as a Tab in the Focused Pane and dragging it onto a Pane opens it there, so that I never go back to the home screen to open something.
6. As a student, I want to drag a Tab onto the other Pane to move it there, so that I arrange my workspace by hand.
7. As a student, I want to drag the divider to resize the Panes, and double-tap it to make them equal, so that I give space to what I'm working on.
8. As a student, I want each Pane to scroll, zoom and take ink on its own, so that the Panes don't interfere.
9. As a student, I want the same Document open in both Panes to show my ink live in both, with one undo history, so that two views of one PDF never fight over its Ink file.
10. As a student, I want closing a Pane's last Tab to close the Pane, and Ctrl+W to close the current Tab, so that empty Panes don't linger.
11. As a student, I want undo history kept while I switch Tabs, and ended only when the Document's last Tab closes, so that switching never loses an undo.
12. As a student, I want Back to go to the home screen and keep my layout, and the app to restore both Panes, every Tab with its page and zoom, the divider and the Focused Pane after a restart, so that I continue where I left off.
13. As a student, I want a PDF dropped from another app onto a Pane copied into the folder of that Pane's current Document and opened as a new Tab in that Pane, so that dropping never replaces what I was reading.
14. As a student, I want a Tab whose Document was moved or renamed outside the app to say so and offer Close, so that a missing file never crashes the view.

### Tree editing (milestone 3)

15. As a student, I want long-pressing a folder to offer New folder, New Notebook, Rename and Move to…, and long-pressing a Document to offer Rename and Move to…, so that I organise courses without a file manager.
16. As a student, I want Move to… to show a folder picker of the Study folder, so that moving is a couple of taps.
17. As a student, I want renaming or moving a Document to carry its Ink file, `.assets` and Versions along, so that my ink follows the PDF.
18. As a student, I want a rename or move that would overwrite an existing name refused with a message, so that the app never replaces a file.
19. As a student, I want Tabs and Recent Documents to follow a Document I rename or move in the app, so that nothing points at the old name.
20. As a student, I want no Delete in the app, so that I can never lose notes by a stray tap; I delete on Drive or in a file manager.
21. As a student, I want **Orphaned ink** shown greyed in the tree with "Link to PDF…", which lets me pick a PDF in the same folder that has no ink yet, so that ink isn't lost when I rename a PDF on Drive.

### Notebooks and inserted pages (milestone 3)

22. As a student, I want New Notebook to ask for a background (blank, lined, grid or dotted) and create a one-page A4 portrait PDF, so that I have a fresh place to write that is still a normal PDF.
23. As a student, I want a new Notebook to go in the folder I long-pressed, or in its `pnotes` folder when I long-press a Course folder that has one, so that personal notes land in the usual place.
24. As a student, I want a new Notebook named `Notes 2026-10-24.pdf` (with `(2)`, `(3)` … if taken), opened straight away with Rename at hand, so that creating one is one step.
25. As a student, I want lined pages at 8 mm, grid and dots at 5 mm, in light grey with a plain top margin, so that pages look like real paper.
26. As a student, I want "Insert page after" in a page menu, with the same four backgrounds, on any Document including Notebooks, so that I have room for long working without changing the PDF.
27. As a student, I want "Add page" at the end of a Notebook, so that a Notebook grows as I write.
28. As a student, I want to remove an inserted page (never one of the PDF's own), with a question first if it has ink, and undo to bring it back, so that a stray page is easy to remove and hard to lose.

### Send to (milestone 3)

29. As a student, I want Send to on each Document with the Gemini app and the Claude app as targets, so that I hand a Document to AI in one step.
30. As a student, I want to choose a Preset (Chapter overview, Answer only, Hint, Full explanation) when sending, with its prompt put on the clipboard, so that I paste it instead of re-typing.
31. As a student, I want Presets in `_ricknotes/presets.json` in my Study folder, written with the defaults the first time, so that I edit them on my laptop and they sync to the tablet.
32. As a student, I want a broken Presets file to fall back to the defaults with a warning saying what is wrong, so that Send to always works.
33. As a student, I want Presets marked "ink on" to say "(ink comes with export)" until milestone 6, so that I know the AI gets the bare PDF for now.

### Sync (milestone 3)

34. As the owner, I want written FolderSync setup steps in the README (two-way, every 15 minutes and when the app goes to the background, keep both on conflict, skip temporary files and `.versions`), so that sync is set up the same way every time.
35. As a student, I want a warning when I open a Document that has a **Conflict copy** of its Ink file, offering Keep mine and Keep the other, so that I choose instead of the app merging them.
36. As a student, I want the copy I didn't keep saved as a Version, so that choosing wrong is never final.

## Implementation Decisions

### Seams

All in `core`, tested on the JVM with a real temporary folder and a fake clock where files are involved. Compose screens, drag and drop, PDF writing and sharing are thin adapters in `app`.

1. **Layout** (new): the Panes, their Tabs and the Focused Pane, as plain data with operations.
2. **Document session** (existing): shared by Tabs, and extended with inserted pages and Conflict copy resolution.
3. **Study folder** (existing): extended with create, rename and move, Orphaned ink, Notebook naming, and Presets.

### Layout seam (milestone 4)

- A Layout is one or two Panes, each an ordered list of Tabs and a selected Tab, plus the divider position (a fraction) and the Focused Pane. A Tab is a Document path relative to the Study folder, with its page and zoom.
- Operations: open a Document in a Pane (as a new Tab, or selecting its Tab if already open there), split (open the current Tab's Document in the other Pane at the same page; creates the second Pane), move a Tab to the other Pane, close a Tab (closing the Pane when it was the last; closing the last Pane leaves an empty Layout), select a Tab, set focus, set the divider, make equal, rename a path (every Tab of that Document follows), and remove a missing path.
- At most two Panes: split with two Panes open opens in the other Pane rather than making a third.
- The Layout is saved as JSON in app settings whenever it changes and restored on start. A restored Tab whose Document is gone becomes a "moved or renamed" Tab rather than being dropped.
- Portrait or landscape only changes how the app draws the two Panes, never the Layout.

### Shared Document sessions (milestone 4)

- A registry in `core` holds one Document session per open Document, counted by the Tabs showing it. Opening a Tab for an open Document reuses its session; closing the last Tab saves and closes it. This replaces "undo history ends when the Tab closes" in the main spec.
- Both Panes draw from the same session, so a stroke in one appears in the other on the next frame.
- Only the selected Tab in each Pane renders pages; other Tabs keep their session and position but draw nothing.

### Tree editing (milestone 3)

- **Companion files** of a Document `X.pdf`: `X.pdf.ink.json`, `X.pdf.assets/`, and its Versions in `.versions/`. A rename or move moves the companions first, then the PDF. If a step fails, the steps already done are moved back and the error says which file failed; nothing is overwritten at any step.
- A Document open in a Tab is saved before it is renamed or moved; its session then follows the new path. The Layout and Recent Documents follow too.
- The target name is checked for the PDF and every companion before anything moves; a clash refuses the whole operation.
- Folder rename or move is one rename of the folder (companions are inside it). Moving a folder into itself is refused.
- **Orphaned ink:** an Ink file whose PDF is missing. "Link to PDF…" lists PDFs in the same folder without an Ink file and renames the companions to match the chosen PDF. The page-count mismatch warning then applies as usual.
- The tree also hides `_ricknotes`.

### Notebooks and inserted pages (milestone 3)

- A Notebook is written with Android's PDF writer: one A4 portrait page (595 × 842 pt) with its background drawn into the PDF, copied in through the Study folder's safe copy so the name gets `(2)`, `(3)` … when taken.
- Background geometry (line spacing, grid and dot spacing, colour, top margin) is one set of named constants in `core`, used for both Notebooks and inserted pages.
- Inserted pages already have a place in the Ink file's page list (main spec, "Ink file format"). Insert and remove are Document session operations, each one undo step. Removing a page keeps its strokes and Pictures in the undo history, so undo brings them back. A PDF's own pages can't be removed.
- An inserted page is drawn by the app (background plus ink), never written into the PDF. "Add page" on a Notebook inserts a page after the last one with the Notebook's background.

### Send to (milestone 3)

- Android share sheet with the PDF (through a content URI), restricted to the Gemini and Claude apps when they are installed, falling back to the full share sheet. The Preset's prompt goes on the clipboard just before the share. The ticket checks how each app receives a shared PDF and records it in the README.
- **Presets file:** `_ricknotes/presets.json` in the Study folder, a list of name, prompt and "ink on". Written with the main spec's Default Presets through the safe write when missing. Loaded and validated each time Send to opens; a broken file uses the defaults and shows what is wrong. It is never overwritten once it exists.

### Conflict copies (milestone 3)

- The ticket checks FolderSync's exact naming for "keep both" copies and records it in the README; `core` recognises that pattern for Ink files (and Revision logs, which already warn).
- On open, a Document with a Conflict copy of its Ink file shows the warning before the pen can write. **Keep mine**: the Conflict copy is moved into Versions. **Keep the other**: the current Ink file is moved into Versions and the Conflict copy takes its place through the safe write. Either way, no file is deleted.

### Logging

- Layout: Pane count, Tab count and restore failures (paths shortened to the file name).
- Tree editing: operation, success or failure, and which step failed; file names only.
- Send to: target app and Preset name, never the prompt text.
- Conflict copies: found and which side was kept.

## Testing Decisions

- **Layout tests** (new): split; split with two Panes open; open an already-open Document; move a Tab; close the last Tab closes the Pane; rename a path updates every Tab; JSON round-trip; a restored missing Document becomes a "moved or renamed" Tab.
- **Shared session tests**: two Tabs share one session; closing one keeps undo; closing the last saves and ends it.
- **Study folder tests**: rename and move carry every companion; a clash refuses with nothing moved; a failure halfway moves everything back; folder into itself refused; Orphaned ink found and linked; Notebook name with clashes; Presets defaults written once, a broken file falls back, an existing file is never overwritten.
- **Document session tests** (prior art: `DocumentSessionTest`): insert and remove pages with undo and redo; removing an inserted page with ink and undoing it; a PDF's own page can't be removed; Conflict copy detected; Keep mine and Keep the other each leave a Version and no deleted file.
- **Not unit-tested:** drawing the Panes, drag and drop, the divider, PDF writing, sharing. Each ticket lists an on-tablet check in the Preview app on a copy of the Study folder.

## Out of Scope

- A third Pane.
- Deleting folders or Documents in the app.
- Drag-to-move in the tree.
- Office files in the tree and "Convert to PDF" (milestone 8).
- Sending a Document with its ink (milestone 6's export).
- Reordering a PDF's own pages, or reordering inserted pages.
- Merging Conflict copies.

## Further Notes

- **Effect on the main spec:** milestone 4 is built before the rest of milestone 3. Story 53's side drawer is the tree drawer in story 5 here. Story 61 (Office files) moves to milestone 8. Story 70 becomes at most two Panes. Presets live in `_ricknotes/presets.json` in the Study folder. Undo history ends when a Document's last Tab closes, not each Tab.
- Milestone 3's "done when" test is unchanged. Milestone 4's is unchanged apart from the two-Pane limit.
