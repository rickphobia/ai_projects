# RickNotes — Revision log, Pictures and UI polish

Owner: @rickphobia · 2026-10-22 · Builds on `docs/spec.md` (milestones 1–2 are done). Words in **bold** on first use are defined in `GLOSSARY.md`. This feature comes before milestone 3; see "Effect on the main spec" at the end.

## Problem Statement

Milestones 1–2 gave me a pen on my PDFs, but three things still stop RickNotes from replacing my old routine:

- **Mistakes and key lecture points go nowhere.** I still copy wrong tutorial questions into `error_logs.pdf` by hand, so I skip it. The important things the lecturer says in class end up scattered across lecture PDFs, and I never look at them again before the exam.
- **I can't get screenshots or new PDFs in.** I screenshot a question, a lecture recording or a Gemini answer, then can't put it next to my working. New tutorial PDFs have to go through a file manager.
- **The app looks unfinished.** Text buttons ("Back", "Undo", "Delete selection"), one flat list of every PDF in the Study folder, no dark mode, and the Lasso's actions sit far from the selection.

## Solution

- **Lasso → Revision log.** I draw a Lasso loop around a question and its working, and the small menu beside the selection offers **Add mistake** and **Add key point**. One tap makes an **Entry** in that course's **Revision log**, with a **Snip** of the area. Each **Course folder** (by default `Y1/Sem1/EE2001`, the third level of the Study folder) has its own Revision log.
- **Review like Anki.** A Review button shows every Entry due today, one card at a time. The front is the area without my ink (just the question); for a **Mistake** I write a **Redo** under it. Show answer reveals my original ink, then **Again** or **Good** schedules the card. **Key points** are cards too.
- **Pictures.** I drag the screenshot preview from the corner, or a PDF, into the app, or use Share → RickNotes. An image becomes a **Picture** on a page that I can move, resize or delete. A PDF is copied into the Study folder and opens.
- **Polish.** An icon toolbar, a floating selection menu, a home screen with Review, Recent Documents and a folder tree, a cleaner page indicator and save state, and dark mode.

## User Stories

### Course folders

1. As a student, I want the folders three levels inside my Study folder (`Y1/Sem1/EE2001`) treated as Course folders without any setup, so that every course gets its own Revision log.
2. As a student, I want to mark any folder as a Course folder, or unmark one, from the home tree, so that an odd folder layout still works.
3. As a student, I want a Document's Entries to go to the nearest Course folder above it, so that `EE2001/tutorial/tuto3.pdf`, `EE2001/notes/lec3.pdf` and a past year paper all share EE2001's log.
4. As a student, I want unmarking a folder never to delete its Revision log, and its Entries still to appear in Review, so that I can't lose Entries by changing a setting.
5. As a student, I want Add mistake and Add key point to explain why they're unavailable when a Document isn't inside any Course folder, and point me to marking one, so that I know what to do.

### Adding Entries

6. As a student, I want the Lasso selection to show a small menu next to it with Delete, Add mistake and Add key point, so that the actions are where my pen already is.
7. As a student, I want Add mistake and Add key point to work even when the loop holds no strokes, so that I can log a printed question before I've written anything.
8. As a student, I want one tap to add the Entry immediately, with an "Added to EE2001 · Edit" note, so that logging never takes long enough for me to skip it.
9. As a student, I want each Entry's Snip to be the rectangle around my loop, including the slide, any Pictures and my ink, so that the whole question is in it even if my loop was loose.
10. As a student, I want each Entry labelled with its Document, page and date, so that I know where it came from.
11. As a student, I want to pick a category (concept, algebra, careless, misread, didn't understand) and write a one-line "why" for a Mistake, from the note or later, so that I see patterns in my mistakes.
12. As a student, I want a "why" line on a Key point as well, but no category, so that I can note what the lecturer stressed.
13. As a student, I want adding an Entry never to change the Document's ink or the PDF, so that the Revision log is only ever a copy.

### The Revision log screen

14. As a student, I want a Revision log row inside each Course folder in the home tree, so that I can browse one course's Entries.
15. As a student, I want the Revision log screen to list Entries newest first, filterable by Mistakes and Key points, so that before an exam I can read every Key point of a course.
16. As a student, I want an Entry's screen to show its Snip with and without my ink, its labels, category, "why" and earlier Redos, so that I see everything about it in one place.
17. As a student, I want "Open in Document" on an Entry to open its Document at that page, so that I see the question in context.
18. As a student, I want a clear "Document not found" message if the Document was renamed or moved, with the Entry still usable, so that a moved PDF doesn't break the log.
19. As a student, I want to delete an Entry only from the Revision log screen, after confirming, and erasing ink in a Document never to delete Entries, so that the log is a real record.

### Review

20. As a student, I want a "Review · N due" button on the home screen, so that I see each day whether I have cards to do.
21. As a student, I want Review to show every due Entry from every Revision log, one course at a time, with a course picker to review only one, so that I have one place to check each day.
22. As a student, I want each card's front to show the Snip area without my ink (slide and Pictures only), so that I see the question and not my old answer.
23. As a student, I want a blank writing area under a Mistake's front where I write my Redo with the pen, which is optional, so that I actually redo the question.
24. As a student, I want Show answer to reveal the back (the same area with my ink, plus the "why" line) with my Redo still visible beside it, so that I can compare.
25. As a student, I want Again and Good buttons after Show answer, so that rating a card is one tap.
26. As a student, I want a new Entry first due 3 days after it was added, Good to stretch the gap each time (about 3 → 7 → 16 → 37 days), and Again to bring it back tomorrow and start the stretching over, so that the things I keep getting wrong come back most.
27. As a student, I want Key points in Review with the same front/back and buttons but no writing area, so that I remember what the lecturer stressed.
28. As a student, I want every Redo kept with its Entry, so that I can see how my attempts changed.
29. As a student, I want leaving Review halfway to keep the ratings I've already given, so that I can stop any time.
30. As a student, I want no daily card limit, so that nothing due is hidden.

### Revision logs never get lost

31. As a student, I want a Revision log saved with the same safe write as Ink files (temporary file, then swap), so that a crash never damages it.
32. As a student, I want Versions of each Revision log, like Ink files, so that I can recover from a disaster.
33. As a student, I want a damaged Revision log never overwritten and opened read-only with a clear message, so that one bad file can't turn into lost Entries.
34. As a student, I want a warning when the sync app has made a Conflict copy of a Revision log, so that I choose which one to keep.
35. As a student, I want a Revision log to be plain files in its Course folder, so that it syncs to Drive with everything else.

### Pictures and bringing files in

36. As a student, I want to drag the screenshot preview from the corner of the screen onto an open page, so that a screenshot lands next to my working.
37. As a student, I want a dropped image placed where I let go, as a Picture at a sensible size, so that I don't have to find it.
38. As a student, I want to select a Picture by tapping it with the Lasso tool, then move it, resize it by its corner (keeping its shape) or delete it, so that it fits beside the question.
39. As a student, I want the pen to write over Pictures, so that I can annotate a screenshot.
40. As a student, I want placing, moving, resizing and deleting a Picture each to be one undo step, so that mistakes are one tap away from gone.
41. As a student, I want Pictures saved beside the Document and recorded in its Ink file, so that the PDF itself never changes.
42. As a student, I want to drop a PDF onto a folder in the home tree, or onto an open page, to copy it into that folder (or the open Document's folder) and open it, so that new tutorials don't need a file manager.
43. As a student, I want a dropped or shared PDF whose name is taken saved as `tuto3 (2).pdf`, so that nothing is ever overwritten.
44. As a student, I want Share → RickNotes from any app: a PDF opens a folder picker starting at the last Document's folder, and an image opens the last Document at its page with the Picture in the middle of the screen, with a "Different Document…" choice, so that it works even where dragging doesn't.
45. As a student, I want a clear message when a dropped or shared file can't be read or isn't an image or PDF, so that I know it wasn't added.
46. As a student, I want the original file never moved or changed, so that my screenshots and downloads stay where they were.

### UI polish

47. As a student, I want an icon toolbar (back, pen, highlighter, eraser, Lasso, undo, redo) with the active tool clearly marked, so that the toolbar is compact and readable at a glance.
48. As a student, I want each icon to have a label on long-press and for accessibility, so that I can learn what an icon does.
49. As a student, I want a cleaner page indicator ("12 / 40") that opens page jump when tapped, so that navigation is obvious.
50. As a student, I want the save state to be quiet when saved and clear when not ("Not saved" stays until a save succeeds), so that I only notice it when it matters.
51. As a student, I want the home screen to show Review, then a row of Recent Documents, then the folder tree, so that what I do most is at the top.
52. As a student, I want the folder tree to open on the semester I used most recently, with courses and chapters collapsible, so that I don't scroll past last year.
53. As a student, I want the app to follow the tablet's dark mode, with PDF pages and Snips staying white, so that the app is easy on the eyes and my ink colours look the same as on paper.
54. As a student, I want `_revision_log` folders, `.assets` folders and Ink files hidden from the tree, so that I only see my PDFs and folders.

## Implementation Decisions

### Seams

Three seams, all in `core` and tested on the JVM with a real temporary folder and a fake clock. Everything Android-specific (rendering Snips, drag and drop, sharing, Compose screens) is a thin adapter in `app`.

1. **Document session** (existing): extended with Pictures.
2. **Revision log** (new): one course's log, plus the Review queue across logs.
3. **Study folder** (new): finding the Course folder for a Document, listing the tree, and copying files in.

### Document session: Pictures

- New operations: place a Picture (image file name, page ID, position, size), move it, resize it, delete it. Each is one undo step, mixed into the same undo history as strokes.
- The Ink file gains a list of Pictures, recorded as decided in the main spec for placed Snips: image file name in `<pdf name>.assets/`, page ID, position and size in page coordinates. The format version goes up; Ink files written before this still open, with no Pictures.
- Placing a Picture copies the image into `<pdf name>.assets/` under a new unique name before the Ink file references it, using the safe write. Deleting a Picture removes it from the Ink file but keeps the image file, so undo works and Versions still point at real files. (Clearing unused images is out of scope.)
- Pictures draw under the ink and above the page. A Picture keeps its shape when resized and stays on its page.
- The Lasso still selects only strokes. With the Lasso tool, a tap on a Picture selects it instead of starting a loop.

### Revision log seam

- A **Revision log session** is opened with a Course folder, a clock and the Study folder. Like the Document session, there is one per Course folder while the app runs, so adding from a Document and rating in Review never race.
- Storage, all inside the Course folder: a hidden-from-the-tree `_revision_log` folder holding `revision_log.json` (the source of truth), and two images per Entry (front without ink, back with ink). Redos are stored in the JSON as strokes, packed with the same point packing as Ink files. Saves use the same safe write, Versions (`.versions` inside `_revision_log`) and save scheduling as the Document session; reuse that code, don't copy it. See decision 0007.
- **Entry** fields: stable ID, kind (Mistake or Key point), Document path relative to the Study folder, page ID and page number, the rectangle in page coordinates, date added, category (Mistakes only, optional), "why" (optional), schedule (due date, current gap in days), the list of Redos (date, strokes), and the list of ratings (date, Again or Good).
- Operations: add Entry (kind, source, rectangle, front and back images), edit category and why, add a Redo, rate, delete. Each saves like a Document change.
- **Schedule:** a new Entry is due 3 days after it's added. Good: the new gap is the old gap × 2.3, rounded to whole days (3 → 7 → 16 → 37 …). Again: due tomorrow, and the next Good goes back to 3 days. "Due" means due date on or before today in the tablet's time zone. The numbers are named constants in `core`.
- **Review queue:** given all Revision logs in the Study folder and today's date, returns due Entries grouped by course, oldest due first within a course. Finding the logs means walking the Study folder for `_revision_log` folders on a background thread.
- A damaged `revision_log.json` opens read-only and is never overwritten; a Conflict copy is detected the same way milestone 3 will detect them for Ink files and warns. Errors use the project's own error types (log damaged, save failed).

### Study folder seam

- **The owner's layout:** `Y<year>/Sem<n>/<course>/`, and a course usually holds four folders: `notes` (textbook, lecture PDFs or slides), `tutorial`, `pnotes` (personal notes) and past year papers. Nothing in the app depends on these four names; only the Course folder's depth (or a mark) matters. Use them in examples, test fixtures and on-tablet checks.

- **Course folder for a Document:** walk up from the Document's folder; the first folder that is marked, or is three levels inside the Study folder and not unmarked, is the Course folder. None found → no Course folder, and the Add actions explain why (story 5).
- Course marks and unmarks are two lists of folder paths in app settings, loaded and validated with the other settings.
- **Tree listing:** folders and PDFs, hiding `_revision_log`, `.assets`, `.versions`, Ink files and temporary files. Browse only; creating, renaming and moving stay in milestone 3.
- **Copy in:** copy a file into a folder with the safe write, picking `name (2).pdf`, `name (3).pdf` … when the name is taken. Never overwrites, never touches the source.
- **Recent Documents:** the last 8 opened, kept in app settings next to the reading positions.

### Snips for Entries

- The `app` renders the rectangle around the Lasso loop twice: once with the page and its Pictures (front), and once with page, Pictures and ink (back). It renders at a fixed resolution with a capped long edge, so a small loop isn't blurry and a full-page loop isn't huge, and saves both as PNG.
- Rendering happens off the main thread; the "Added" note appears once both images are written.

### Bringing files in (`app` adapters)

- Drag and drop with Compose's drag-and-drop target on the page view and on folder rows in the home tree, asking Android for read permission on dropped content URIs. Accepts images (PNG, JPEG, WebP) and PDFs.
- Share → RickNotes: the Activity accepts shared images and PDFs. It routes them as in story 44.
- The adapter reads the content into a temporary file, then hands it to the Study folder seam (PDF) or the Document session (image). A file that can't be read or decoded shows a message and is logged (type and size only).

### UI polish (`app`)

- Material icons for the toolbar, with labels for long-press and accessibility. The toolbar ticket checks the size cost of the icon library and only bundles the icons it uses.
- The floating Lasso menu sits beside the selection's bounds, stays on screen, and moves with the selection.
- The home screen and Revision log screens use the Study folder and Revision log seams. Screens stay thin: no file walking or scheduling in Compose code.
- Material 3 theme with light and dark colour schemes following the system setting. Page renders, Snips and Pictures are never tinted.

### Logging

- Log Entry added, rated, deleted and Redo saved (course folder name, Entry ID, kind, rating), Revision log saves and failures, Picture placed (size in bytes and pixels), files copied in (type, size, name clash), and drag or share failures. Never log Snip images, strokes or the "why" text.

## Testing Decisions

- **What makes a good test:** it drives a seam the way the app does and checks what a user would notice: what's on disk, what reopens, what's due. No tests of private functions or internal structures.
- **Document session tests** (prior art: `DocumentSessionTest`): place, move, resize and delete a Picture and reopen with it there; undo and redo across strokes and Pictures; an old Ink file without Pictures opens; the image is in `.assets` before the Ink file references it.
- **Revision log tests** (new, same style): add an Entry and reopen; first due 3 days later; Good and Again change the due dates as specified; the Review queue across two Course folders, grouped by course; a Redo round-trips its strokes exactly; delete; a damaged log opens read-only and isn't overwritten; a failed save leaves the old file whole; Versions are taken.
- **Study folder tests** (new): Course folder resolution at depth 3, with a marked folder, with an unmarked folder, and outside any course; the tree hides app files; copying in with one and with two name clashes; the source is unchanged.
- **Not unit-tested:** Snip rendering, drag and drop, sharing and Compose screens. Each ticket lists an on-tablet check in the Preview app, including whether dragging the screenshot preview works on ZUXOS.

## Out of Scope

- Collecting Red ink into the Revision log automatically (stays in the main spec's milestone 5).
- Generating a PDF of a Revision log.
- Hard and Easy buttons, a Retire action, and daily card limits.
- Making white see-through, "lift subject", trimming, and pasting a Snip into another Document (milestone 7).
- Creating, renaming and moving folders and Documents (milestone 3).
- Turning a dropped image into a new PDF, or a dropped image straight into a Revision log.
- Darkening PDF pages in dark mode.
- Clearing unused images from `.assets`.

## Further Notes

- **Check on the tablet:** whether ZUXOS lets you drag the screenshot preview into another app. If it doesn't, Share → RickNotes covers it; record the result in the README.
- **Effect on the main spec:** this feature is done before milestone 3. Milestone 5 (Error log) shrinks to automatic Red ink collection into the Revision log and a generated PDF of the log. From milestone 7, Pictures already exist; a pasted Snip becomes a Picture.
- **For milestone 3's grilling:** new Notebooks most likely belong in a course's `pnotes` folder; settle that default then.
- A Snip includes Pictures because it's rendered from the page as shown, so a screenshot dropped onto a page can then be lassoed into the Revision log.
