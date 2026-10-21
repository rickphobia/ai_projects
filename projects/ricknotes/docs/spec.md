# RickNotes — Spec v1

Owner: @rickphobia · 2026-10-04 · Replaces the "Study Notes App" draft spec. Words in **bold** on first use are defined in `GLOSSARY.md`; the decisions behind this spec are in `docs/decisions/`.

## Problem Statement

I study lecture and tutorial PDFs with a pen on a Lenovo Xiaoxin Pad Pro 12.7 (TB375FC, Android 16) and a Lenovo Xiaoxin Stylus 2023. Today that takes three tools that don't talk to each other:

- **Nebo** for writing on PDFs. It keeps my notes in its own library instead of in my course folders, so they are not plain files I can sync, back up or open elsewhere.
- **A floating Gemini window** for asking about a page. I re-type the same instructions ("answers only, no working") every time.
- **`error_logs.pdf`**, which I fill by hand: copying every question I got wrong, labelling it, and remembering to redo it.

Copying errors by hand is slow, so I skip it, and I lose the record of what I keep getting wrong. And a note app that silently loses ink is the worst possible failure: I'd find out the night before an exam.

## Solution

RickNotes is an Android tablet app that is a window onto my **Study folder**, the same folder of courses, chapters and PDFs that a sync app mirrors to Google Drive.

- I open any **Document** (a PDF) and write on it with the pen. The PDF is never changed: my ink is saved in an **Ink file** beside it, like tracing paper over a printed page.
- I can make a **Notebook** (a new blank A4 PDF with lined, grid, dotted or blank pages) and insert blank pages into any Document for extra working space.
- **Red ink** means "I got this wrong". The app collects red ink into an **Error log** by itself: one **Entry** per mistake, with a picture, course, Document, page and date, a category, a "why" line and redo dates, and a Review screen of what's due today.
- Two Documents side by side in a split view, like VS Code, with tabs in each **Pane**.
- A **Send to** menu sends a Document (or later a **Snip**) to the Gemini or Claude app with a **Preset** prompt ready to paste, so I never re-type instructions.
- Snips: cut part of a page, clean its background, and drop it into another Document, the error log, or another app.
- "Convert to PDF" on a pptx or docx sends it to LibreOffice on my home server.
- Notes are protected: safe saves, **Versions** I can restore, and warnings instead of silent merges.

## Build order

One **Milestone** at a time. A milestone is several tickets (one PR each) and is done only when its "done when" test passes on the tablet with the owner holding the pen.

| # | Milestone | Done when |
|---|-----------|-----------|
| 1 | Open a Document from the Study folder; scroll and zoom | A 100-page lecture scrolls and zooms smoothly with no stutter, in the **Preview app** installed from a PR |
| 2 | Pen on a Document, saved to its Ink file | Write, force-close, reopen: the ink is all there. A page of tutorial working feels as good as Nebo. Palm resting on the screen never marks or erases |
| 3 | Folder tree, Notebooks, inserted pages, Send to app, sync set up | Ink written on the tablet shows up in the Drive copy within 15 minutes; a new Notebook opens in another PDF reader; a Document sent to Claude arrives with the preset prompt on the clipboard |
| 4 | Split view | The split button or Ctrl+\ opens a second Pane; each Pane holds Tabs; dragging a Tab across moves it; the layout comes back after restarting the app |
| 5 | Error log | 3 red marks on 2 pages make 3 labelled Entries; collecting again adds none; Review shows Entries due today |
| 6 | Export with ink and Version restore | An exported PDF opens with ink in another reader; an old Version restores correctly |
| 7 | Snips | A slide diagram dragged onto a tutorial shows with a see-through background; a Snip sent to the error log appears as a Confused entry; the tutorial PDF itself is unchanged |
| 8 | Office converter | A lecture pptx converted from the tablet at the dorm opens as a Document beside the original |

Milestones 1–2 are specified in detail below and ticketed now. Milestone 2 is make-or-break: if handwriting feels laggy, fix that before anything else. Milestones 3–8 are settled at the level written here and get a short grilling session before they are ticketed. After milestone 8, use the app for one full week of real coursework and list every annoyance; that list is the v2 spec.

## User Stories

### Getting builds onto the tablet

1. As the owner, I want every merged change to arrive on my tablet as an update to "RickNotes", so that I can install it at the dorm without the Beelink.
2. As the owner, I want Obtainium to offer me each new RickNotes release, so that I don't have to look for APKs by hand.
3. As the owner, I want every green pull request to give me a "Try this version" link to an APK, so that I can try a change on the tablet before I merge it.
4. As the owner, I want pull-request builds to install as a separate "RickNotes Preview" app, so that a half-finished feature can never replace the app I rely on mid-tutorial.
5. As the owner, I want RickNotes Preview to have its own Study folder setting, so that I point it at a copy of my notes and an unmerged build can never touch the real ones.
6. As the owner, I want every APK signed with the same key, so that updates install over the old app without wiping my settings.
7. As a developer on a fresh machine, I want one setup command that installs the pinned Android SDK, so that I can build and test without Android Studio.
8. As the owner, I want CI to run lint and unit tests on every push, so that a broken build never reaches `main`.

### Opening Documents (milestone 1)

9. As a student, I want to pick my Study folder once, so that the app always opens onto my courses.
10. As a student, I want the app to ask for "All files access" with a clear explanation of why, so that I understand what I'm granting.
11. As a student, I want a simple list of the PDFs in my Study folder before the full folder tree exists, so that I can open a Document from milestone 1.
12. As a student, I want a Document to scroll continuously from page to page, so that reading a long lecture feels like Nebo.
13. As a student, I want to pinch to zoom, so that I can read small circuit labels like R₂.
14. As a student, I want pages to become sharp again shortly after I stop zooming, so that zoomed-in text isn't blurry.
15. As a student, I want a 100-page lecture to scroll without stutter, so that the app is usable for real courses.
16. As a student, I want to see which page I'm on and jump to a page number, so that I can find the question the lecturer mentioned.
17. As a student, I want each Document to reopen at the page and zoom I left it, so that I can pick up where I stopped.
18. As a student, I want a clear message when a PDF can't be opened (damaged or password-protected), so that I know it's the file and not the app.

### Writing (milestone 2)

19. As a student, I want to write with the stylus with no noticeable lag, so that working out a tutorial feels like paper.
20. As a student, I want the stroke to respond to pen pressure, so that my handwriting looks natural.
21. As a student, I want pens in black, blue, red and green, so that I can use colour the way I do on paper.
22. As a student, I want a highlighter that sits under my writing and doesn't hide the text, so that I can mark key lines in a lecture.
23. As a student, I want a stroke eraser that removes whole strokes I touch, so that I can fix mistakes quickly.
24. As a student, I want a Lasso that selects my strokes so I can move or delete them, so that I can make room for working I forgot.
25. As a student, I want undo and redo for each open Document, so that a mistake is one tap away from gone.
26. As a student, I want undo history to last as long as the Tab is open, so that I can undo several steps back.
27. As a student, I want strokes to stay attached to the right spot on the page at any zoom and scroll position, so that my notes line up with the slide.
28. As a student, I want strokes to sit exactly where I drew them after I reopen the Document, so that saved ink never shifts.

### Palm rejection and gestures (milestone 2)

29. As a student, I want a finger or palm never to draw, so that resting my hand on the screen leaves no marks.
30. As a student, I want one finger to scroll by default, so that I can read a lecture one-handed.
31. As a student, I want two fingers to always scroll and pinch-zoom, so that navigation works the same whatever my settings.
32. As a student, I want an on/off **Finger erase** setting that makes one finger erase whole strokes, so that I can erase without switching tools.
33. As a student, I want finger touches ignored while the pen hovers near the screen and for a moment after it lifts, so that my writing hand can't erase anything.
34. As a student, I want touches larger than a fingertip ignored, so that a palm Android didn't catch in time still erases nothing.
35. As a student, I want each finger erase to be one undo step, so that an accidental erase is easy to reverse.
36. As a student, I want a two-finger tap to undo and a three-finger tap to redo, each with its own on/off switch, so that I don't reach for the toolbar.

### Pen test and quick colour switch (milestone 2)

37. As the owner, I want a pen test screen that shows every event my Lenovo Xiaoxin Stylus 2023 sends, so that we learn which buttons reach the app.
38. ~~Pen button actions~~ Dropped: the pen test showed the stylus's side button never reaches apps on ZUXOS, and the pen has no eraser end.
39. ~~Pen button defaults~~ Dropped with 38.
40. As a student, I want tapping the current pen in the toolbar to cycle through my **Favourite pens** list (default black → blue → red → green), so that switching to red for marking is one tap.
41. As a student, I want to edit my Favourite pens list in Settings, so that the cycle only goes through the colours I use.

### Notes that never get lost (milestone 2, and every milestone after)

42. As a student, I want my ink saved within 2 seconds of my last stroke, so that a crash loses at most a couple of strokes.
43. As a student, I want my ink saved whenever the app goes to the background, so that switching to Gemini never risks my notes.
44. As a student, I want saves to write a temporary file and then swap it in, so that a crash mid-save leaves the old Ink file whole.
45. As a student, I want the PDF itself never to be written to, so that a bug can never damage a lecture.
46. As a student, I want a Version of the Ink file taken when I open a Document, before my first new stroke, so that I can always get back to how it was before this session.
47. As a student, I want a Version at most every 15 minutes while I write, and only the newest 10 kept, so that I can go back hours without filling the tablet.
48. As a student, I want a clear "Not saved" warning that stays until a save succeeds, so that a full disk or a permissions problem never fails silently.
49. As a student, I want a damaged Ink file never to be overwritten, and the Document opened read-only with an offer to restore a Version, so that one bad file can't turn into lost notes.
50. As a student, I want a warning when the PDF beside an Ink file has a different page count from when I wrote on it, so that I know my ink may not line up after a lecturer re-uploads slides.
51. As the owner, I want a log I can share from Settings, so that I can report a bug from the dorm without the Beelink or adb.
52. As the owner, I want the log to hold no note content and to stay within a few MB, so that it is safe to attach to a GitHub issue.

### Folder tree, Notebooks and inserted pages (milestone 3)

53. As a student, I want a side drawer showing my Study folder as a tree, so that I find Documents by course and chapter.
54. As a student, I want to create, rename and move folders and Documents in the tree, so that I organise courses without a file manager.
55. As a student, I want renaming or moving a Document in the app to carry its Ink file, assets and Versions along, so that my ink follows the PDF.
56. As a student, I want Ink files, assets and Versions hidden from the tree, so that I only see my PDFs and folders.
57. As a student, I want **Orphaned ink** shown greyed with a "Link to PDF…" action, so that ink isn't lost when I rename a PDF on Drive.
58. As a student, I want a warning when the sync app has made a **Conflict copy**, so that I choose which version to keep instead of the app merging them.
59. As a student, I want to create a Notebook of A4 portrait pages with a blank, lined, grid or dotted background, so that I have a fresh place to write that is still a normal PDF.
60. As a student, I want to insert a blank page (with any of those backgrounds) after any page of any Document, and remove it again, so that I have room for long working without changing the PDF.
61. As a student, I want **Office files** shown in the tree with a "Convert to PDF" action, so that I can see slides that still need converting.
62. As a student, I want a Send to menu on each Document with targets Gemini app and Claude app, so that I hand a Document to AI in one step.
63. As a student, I want to choose a Preset (Chapter overview, Answer only, Hint, Full explanation) when sending, with its prompt put on the clipboard, so that I paste it instead of re-typing.
64. As a student, I want Presets kept in a settings file, so that adding or editing one doesn't need a code change.
65. As the owner, I want written FolderSync setup steps (two-way, every 15 minutes and when the app goes to the background, keep both on conflict, skip temporary files and Versions), so that sync is set up the same way every time.

### Split view (milestone 4)

66. As a student, I want a split button in each Pane's toolbar, and Ctrl+\ on a keyboard, to open the current Document in a new Pane at the same page, so that I see the lecture and the tutorial side by side.
67. As a student, I want tabs in each Pane, so that I keep several Documents open in one Pane.
68. As a student, I want to drag a Tab to the other Pane, and drag a Document from the tree onto a Pane, so that I arrange my workspace by hand.
69. As a student, I want to drag the divider to resize, and double-tap it to make Panes equal, so that I give space to what I'm working on.
70. As a student, I want up to 3 Panes side by side in landscape and stacked in portrait, so that the layout fits how I hold the tablet.
71. As a student, I want each Pane to scroll, zoom and take ink on its own, so that the Panes don't interfere.
72. As a student, I want closing a Pane's last Tab to close the Pane, so that empty Panes don't linger.
73. As a student, I want the layout (Documents, pages, Pane sizes) restored when I reopen the app, so that I continue where I left off.

### Error log (milestone 5)

74. As a student, I want red strokes drawn close together, within about a minute of each other, to count as one mistake, so that one wrong answer makes one Entry.
75. As a student, I want a "Collect errors" button, which also runs when I close a Document, so that my red ink reaches the error log without copying.
76. As a student, I want only groups whose last red stroke is over a minute old collected, so that a half-finished correction isn't logged.
77. As a student, I want collecting again to add only new red ink, never duplicates, so that the log stays clean.
78. As a student, I want each **Wrong entry** to show a picture of the whole page as it was when collected (slide, my ink and my red ink), with a box around that mistake's red ink and the Entry opening zoomed to that box, labelled with course, Document, page and date, so that the question is always in the picture wherever it sits on the page, and I can redo it without opening the Document.
79. As a student, I want to pick a category (concept, algebra, careless, misread) and write a one-line "why" for each Entry, so that I see patterns in my mistakes.
80. As a student, I want each Entry to get redo dates 3 and 7 days later, and a Review screen listing Entries due today, so that I actually redo them.
81. As a student, I want an Entry to stay if I later erase its red ink, and to be deleted only from the Review screen, so that the log is a real record.
82. As a student, I want an `error_log.pdf` generated from the log, so that I can print or share it.
83. As a student, I want tapping an Entry to open its Document at that page, so that I see the question in context.

### Export and Version restore (milestone 6)

84. As a student, I want "Export with ink" to make a new PDF with my strokes, inserted pages and placed Snips drawn in, leaving the original untouched, so that I can share or print my notes.
85. As a student, I want a screen listing the Versions of a Document's Ink file with their times, and a restore button, so that I can undo a disaster from yesterday.
86. As a student, I want restoring to take a Version of the current state first, so that a restore is itself reversible.
87. As a student, I want an "Include my ink" switch in Send to, off by default for Chapter overview and on for the others, so that the AI sees my working when it matters.

### Snips (milestone 7)

88. As a student, I want a Snip tool that cuts a rectangle or a freehand loop from any page, including the slide and my ink, so that I can reuse part of a page.
89. As a student, I want "make white see-through" on a Snip, so that a slide diagram pastes without a white box around it.
90. As a student, I want "lift subject" for photos on slides, working offline, so that a picture of a real component pastes cleanly.
91. As a student, I want to trim a Snip's edges and resize it after pasting, so that it fits next to the question.
92. As a student, I want to drag a Snip from one Pane and drop it on the other where my finger lets go, so that moving a diagram into the tutorial is one gesture.
93. As a student, I want copy and paste for Snips, also putting them on the Android clipboard, so that I can move them between Documents that aren't side by side.
94. As a student, I want to send a Snip to the error log as a **Confused entry**, with the same labels, category, why and redo dates, so that things I didn't understand get reviewed too.
95. As a student, I want to share a Snip to the Gemini or Claude app with a Preset on the clipboard, so that I ask about exactly one question.
96. As a student, I want placed Snips saved as images beside the Document and recorded in its Ink file, so that the PDF still never changes.

### Office converter (milestone 8)

97. As a student, I want "Convert to PDF" on a pptx or docx to produce a PDF beside the original, so that new slides become Documents without the laptop.
98. As a student, I want a clear message when the Beelink can't be reached, so that I know to try later or convert on the laptop.
99. As the owner, I want the converter to be reachable only over Tailscale, with a health check, so that it isn't exposed to the internet and I can see when it's down.

## Implementation Decisions

### Platform and distribution

- Native Kotlin + Jetpack Compose, Jetpack Ink for strokes, Android's `PdfRenderer` for pages (decision 0001). The first ticket looks up and records the current stable versions of Jetpack Ink and the other AndroidX libraries; it does not assume them.
- Requires Android 16 (API 36) and targets the newest stable SDK. The app runs on one tablet, so there is no reason to support older versions.
- File access through "All files access" with normal paths (decision 0002). The Study folder is stored as a path in the app's settings.
- Two app variants from one codebase: **RickNotes** (`com.rickphobia.ricknotes`) built from `main`, and **RickNotes Preview** (`com.rickphobia.ricknotes.preview`) built from pull requests. Each has its own settings, so each has its own Study folder.
- One release signing key for every APK, kept outside the repo on the Beelink with a backup, and in CI as an encrypted secret (decision 0004). `versionCode` is the CI run number, so it always goes up.
- CI (`.github/workflows/ricknotes.yml`, scoped to `projects/ricknotes/**`) runs ktlint, detekt, Android lint, the JVM unit tests and a signed release build. On `main` it publishes a GitHub Release `ricknotes-v<N>` with the RickNotes APK; on a green PR it publishes or replaces a prerelease `ricknotes-pr-<N>` with the Preview APK and puts the link in the PR body, and deletes it when the PR closes. Obtainium on the tablet watches releases named `ricknotes-v*` (check Obtainium's filter option when building this).
- Gradle wrapper, version catalog and JDK toolchain pin every tool version. A project setup script installs the pinned Android command-line tools and SDK packages, so the Beelink and a cloud session can build without Android Studio.
- Optional developer tool: connecting adb to the tablet over Tailscale for live logs and performance traces while tuning pen lag. Check that it works before relying on it; it is never the install path.

### Module layout

- **`core`**: a pure Kotlin module with no Android imports. It holds all the rules: the Ink file model and its encoding, the Document session (strokes, pages, undo/redo, save scheduling, Versions, safe writing), the touch interpreter, and settings models. Everything here is unit-tested on the JVM.
- **`app`**: the Android module. Its adapters are thin: page rendering with `PdfRenderer`, stroke drawing with Jetpack Ink, conversion of Android touch events into the plain events `core` understands, settings storage, the rolling log file, and Compose screens. The Activity only wires things together.
- Later milestones add to `core` by feature (error log, layout, export planning) and to `app` by adapter (share menu, PDF writer, converter client). The converter service in milestone 8 lives in its own folder inside the project with its own Dockerfile and deploy script.

### Seam 1: Document session

The main test seam. One session per open Document; the UI talks only to it.

- Opened with a Document path, a clock and the settings it needs. On open it reads the Ink file (or starts empty), takes a Version if an Ink file exists, and reports warnings: page-count mismatch, damaged Ink file, Conflict copy (milestone 3).
- Operations: add stroke, erase strokes, move or delete a Lasso selection, insert or remove a blank page (milestone 3), undo, redo. Each operation is one undo step; undo history is in memory only and ends when the Tab closes.
- Saving: a save is scheduled 2 seconds after the last change and forced when the app goes to the background. It writes a hidden temporary file in the same folder, flushes it to disk, then renames it over the Ink file in one atomic step. A failed save leaves the old file in place, keeps the changes in memory, retries, and shows "Not saved" until it succeeds.
- Versions: a copy of the Ink file goes into a hidden `.versions` folder beside the Document when the session opens (before the first change) and at most every 15 minutes of writing after that. The newest 10 per Document are kept.
- A damaged Ink file is never overwritten. The session opens read-only and offers the Versions.
- Failures use the project's own error types (for example, Ink file damaged, save failed, PDF missing), so the UI can tell them apart and show the right message.

### Ink file format

Decision 0003 has the reasons. One file per Document, named `<pdf name>.ink.json`, beside the PDF.

- Readable JSON with a format version number, the PDF's page count when the file was last saved, the page list, and the strokes.
- **Page list:** the PDF's own pages plus any inserted pages, each with a stable ID, so inserting a page never renumbers anything. An inserted page records its background (blank, lined, grid, dotted) and has A4 portrait size.
- **Each stroke:** a stable ID, the page ID it belongs to, tool (pen or highlighter), colour, width, time drawn, and its points (x, y, pressure, time) in page coordinates, packed by `core` itself as difference-encoded integers stored as text (decision 0003). Jetpack Ink's own encoding is not used, because it is Android-only and would keep Ink files out of the JVM tests. Page coordinates are PDF points (1/72 inch), so ink lines up at any zoom or screen size.
- Placed Snips (milestone 7) are recorded as an image file name in `<pdf name>.assets/`, page ID, position and size.
- Hidden temporary files and `.versions` use names the sync app can be told to skip.

### Seam 2: Touch interpreter

The second test seam. It takes plain touch events (pointer ID, pen or finger, position, pressure, contact size, hovering, time) and the current settings, and returns actions: draw, erase strokes at a point, scroll or zoom, undo, redo, or ignore.

- Pen: draws with the current tool.
- One finger: scrolls by default. With Finger erase on, it erases whole strokes instead, as one undo step per gesture.
- Two fingers: always scroll and pinch-zoom.
- Finger touches are ignored while the pen hovers and for about 0.5 s after it lifts, and any touch with a contact larger than a fingertip is ignored. Touches Android marks as a palm or cancels are dropped.
- A two-finger tap undoes and a three-finger tap redoes (a tap is a short touch without movement), each behind its own switch.
- Thresholds (lockout time, size limit, tap time and distance) are named settings in `core` so they can be tuned on the tablet without hunting through code.

### Pen test screen and Favourite pens

- A hidden pen test screen (reached from Settings) lists every touch, hover, button and key event the stylus produces. Its findings for the Lenovo Xiaoxin Stylus 2023 are in the README: ZUXOS keeps the side button for itself (even with its system actions turned off) and the pen has no eraser end, so there are no pen button actions in v1. If a future pen's buttons do reach apps, the pen test screen will show it.
- Tapping the current pen in the toolbar cycles through the Favourite pens list, editable in Settings (default black → blue → red → green).

### PDF view

- Our own Compose view over `PdfRenderer`, not the Jetpack PDF viewer component, because the ink layer, Panes and Snips all need control over how pages are drawn.
- Continuous vertical scroll and pinch zoom. Pages are drawn at screen resolution for the current zoom, re-rendered sharp once a zoom settles, and kept in a memory-limited cache. `PdfRenderer` is used from one background thread per Document, because it isn't safe to share between threads.
- The ink layer is drawn in page coordinates and transformed with the page, so strokes stay put while scrolling and zooming. Strokes in progress use Jetpack Ink's low-latency drawing.

### Settings and configuration

- App settings (Study folder, Finger erase, tap gestures, Favourite pens, last page and zoom per Document) live in the app's private storage and are loaded and validated in one place.
- Presets (milestone 3) are a JSON file listing each Preset's name, prompt and whether ink is included by default. The app ships a default file, and editing it needs no code change.
- Build-time values (signing key location and passwords, and later the converter's Tailscale address) come from environment variables listed in `.env.example`, never from code.

### Logging

- A rolling log file in the app's private storage, capped at a few MB, with levels. It records Document open and close (file name only), save timings and failures, page render times, warnings shown, and errors with what was being done. It never records stroke data, page images or clipboard text.
- Settings has a "Share log" button that sends the file through the Android share menu.

### Milestones 3–8, as settled so far

- **Sync:** FolderSync, two-way, every 15 minutes and when the app goes to the background, "keep both" on conflict, skipping the app's temporary files and `.versions`. The app detects Conflict copies by FolderSync's naming (check the exact pattern when building this) and warns; it never merges them.
- **Notebooks** are made with Android's built-in PDF writer: A4 portrait pages with the background printed in, chosen at creation. More pages are added as inserted pages.
- **Send to:** Android share menu with the Document (later a Snip) and the Preset's prompt on the clipboard; the ticket checks how the Gemini and Claude apps each receive shared files and text. "Include my ink" arrives with export in milestone 6.
- **Error log:** `_error_log/error_log.json` is the source of truth, with one picture per Entry beside it (a Wrong entry's picture is the whole rendered page, and the Entry stores the box around its red ink in page coordinates); `error_log.pdf` is generated from them and never edited. Entries remember the stroke IDs they came from, which is how "no duplicates" is checked.
- **Export** draws pages, inserted pages, strokes and Snips into a new PDF with Android's PDF writer. The exact file naming and location are decided when milestone 6 is grilled.
- **Snips:** "Lift subject" uses Google's on-device ML Kit subject segmentation (the tablet has Google Play services); "make white see-through" is our own pixel step. Placed Snips are stored as described in the Ink file format.
- **Converter:** LibreOffice in Docker on the Beelink, listening only on the Tailscale address, with a health check and a deploy script (decision 0006).

### Default Presets

Starting prompts, to be edited in the Presets file:

- **Chapter overview** (ink off): "These are lecture slides. Give me a chapter overview: list the major concepts; under each, the smaller concepts; for each smaller concept, an explain-like-I'm-five explanation, the key formula, and one example question with its worked answer. Use the notation on the slides."
- **Answer only** (ink on): "These are tutorial questions. Give only the final answer to each question, numbered as in the document, with units. No working."
- **Hint** (ink on): "I'm working on this tutorial question. Give me one hint that gets me to the next step. Do not give the answer or any working beyond that step."
- **Full explanation** (ink on): "Solve this tutorial question step by step. Show every step of working, say which formula or rule each step uses, and give the final answer with units. Where my handwritten working is visible, point out where it went wrong."

## Testing Decisions

- **What makes a good test:** it drives one of the two seams the way the app does and checks what a user would notice: what's on disk, what's restored, which action a touch produced. It does not check private functions, call order or internal data structures, so the code behind a seam can be rewritten without touching the tests.
- **Document session tests** use a real temporary folder and a fake clock. They cover:
  - draw, wait 2 s, reopen with all strokes there
  - a failed or interrupted save leaves the old Ink file whole, and a stray temporary file is ignored on open
  - Versions taken on open and at most every 15 minutes, with only 10 kept
  - a damaged Ink file opens read-only and is never overwritten
  - the page-count mismatch warning
  - undo and redo across add, erase and Lasso moves
  - stable stroke and page IDs
  - the Ink file round-trips exactly, including packed points
- **Touch interpreter tests** feed invented event sequences. Examples: a palm landing 200 ms after the pen lifts; a large contact; one finger with Finger erase on and off; two-finger scroll; two- and three-finger taps; a pen and a finger at once.
- **Not unit-tested:** rendering, Jetpack Ink drawing and Compose screens. Each ticket lists a short on-tablet check, run in the Preview app on a copy of the Study folder. Each milestone's "done when" test is the gate.
- **Prior art:** none in this repo (the other projects are Godot and web). Ticket 01 sets the conventions: JUnit tests in `core` mirroring its packages, run with one Gradle command named in the README and in CI.
- Rule 6 from the original spec (test every build on a copy of the Study folder) is enforced by the Preview app, not by discipline.

## Out of Scope

- A built-in AI panel calling model APIs (decision 0005). The Gemini and Claude apps are used through Send to.
- An infinite canvas ("Board").
- Its own sync; FolderSync handles it.
- A laptop or Windows version, and the Play Store.
- Opening pptx or docx directly (they are converted to PDF instead).
- Changing an existing PDF in any way, including deleting or reordering its own pages.
- Turning handwriting into typed text.
- Sharing or editing notes with other people.
- Detailed design of milestones 3–8 beyond what is written here.

## Further Notes

- **Rules that protect notes**, which every ticket follows: never change an existing PDF; save within 2 seconds and on going to the background; always save via temporary file and swap; keep Versions and a restore screen; warn about Conflict copies, never merge; test in the Preview app on a copy of the Study folder; keep Nebo or Xodo installed for the first 2 weeks of the semester.
- **To check before or during the relevant ticket, not assumed:** current Jetpack Ink and AndroidX versions; Obtainium's release-name filter; FolderSync's Conflict copy naming; whether adb over Tailscale connects to the tablet; how the Gemini and Claude apps accept shared files plus text.
- The tablet is at the dorm and the Beelink at home. Anything that has to work day to day must work with only GitHub and the tablet; the Beelink is for development sessions (reachable over Tailscale and code-server) and, from milestone 8, the converter.
