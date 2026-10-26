# RickNotes — Red ink to the Revision log, and a PDF of the log

Owner: @rickphobia · 2026-10-26 · Settles milestone 5 of `docs/spec.md` after its grilling. Words in **bold** on first use are defined in `GLOSSARY.md`. Where this file and the main spec's stories 74–83 differ, this file wins; see "Effect on the main spec" at the end.

## Problem Statement

The Revision log works, but two things from my old routine are still missing:

- **Red ink stays where I wrote it.** When I mark a tutorial answer wrong in red, I still have to remember to Lasso it and tap Add mistake. Most of the time I don't, so the mistake never reaches Review.
- **I can't get a log out of the app.** Before an exam I want a course's Mistakes and Key points on paper, or to send them to a friend, and the log only exists as screens and hidden files.

## Solution

- **A Red ink list.** The Document toolbar shows "Red ink · 3" when the Document has **Red marks** not yet in the Revision log. A Red mark is one group of red strokes that I wrote for one mistake. Tapping the badge opens a list: each row shows the Red mark and its page. **Add mistake** puts it in the course's Revision log with one tap; **Not a mistake** hides it for good. Nothing is ever added without my tap.
- **Whole-page Entries.** A Mistake added from a Red mark keeps the whole page, so the question is always in it wherever it sits. It opens zoomed to the red ink, with a box around it on the back.
- **Export PDF.** A course's Revision log screen gets an Export PDF button that writes `<course> revision log.pdf` into the Course folder and offers Share.

## User Stories

### Red marks

1. As a student, I want only strokes from the red pen counted as Red ink, never the highlighter or other pens, so that only "I got this wrong" ink is offered.
2. As a student, I want red strokes on one page that I write close together in time (within about a minute of the previous one) and close together on the page to count as one Red mark, so that the cross, the fix and the note for one question make one Mistake.
3. As a student, I want two quick corrections far apart on the page to be two Red marks, so that two wrong questions make two Mistakes.
4. As a student, I want a Red mark offered only once its last stroke is over a minute old, so that a correction I'm still writing isn't offered half-finished.
5. As a student, I want red ink I wrote before this feature to be offered too, so that I can log mistakes from past tutorials.

### The Red ink list

6. As a student, I want a "Red ink · N" badge in the Document toolbar counting the Red marks not yet logged or hidden, and no badge when there are none, so that I see at a glance that something is waiting.
7. As a student, I want the badge to update as I write and as Red marks turn a minute old, so that the count is right without reopening the Document.
8. As a student, I want tapping the badge to open a list of the Red marks, each with a small picture and its page number, in page order, so that I can go through them.
9. As a student, I want tapping a row to jump to that page with a box around the Red mark, so that I see which ink it means.
10. As a student, I want Add mistake on a row to add it to the Revision log in one tap and show "Added to EE2001 · Edit", so that logging stays fast; Edit opens the Entry to set its category and "why".
11. As a student, I want Not a mistake on a row to hide that Red mark for good, so that red ink that isn't a mistake stops being offered.
12. As a student, I want no reminder when I close a Document with Red marks left, so that the app doesn't nag me.
13. As a student, I want the badge, when the Document isn't inside any Course folder, to explain why its red ink can't be logged and point me to marking a Course folder, as Add mistake already does, so that I know what to do.
14. As a student, I want marking that folder as a Course folder later to make its Red marks show up, so that nothing is lost by marking late.
15. As a student, I want the badge hidden when the Document or its Revision log is open read-only, so that I'm not offered something that can't be saved.

### Entries from Red marks

16. As a student, I want a Mistake added from a Red mark to keep the whole page: the front without ink and the back with ink, with a box around the Red mark on the back, so that the question is always in the picture.
17. As a student, I want that Mistake to open zoomed to the Red mark's box with some margin, in Review and on its Entry screen, with pinch to zoom out to the whole page, so that the question is right there on a small screen.
18. As a student, I want its category and "why" to start empty and be set later from the "Added" note or the Revision log screen, so that adding stays one tap.
19. As a student, I want "Open in Document" on such an Entry to open its Document at that page, as for other Entries, so that I see the question in context.

### No duplicates

20. As a student, I want a Red mark already added never offered again, so that the log has no duplicates.
21. As a student, I want Add mistake from the Lasso to count the red strokes inside its loop as logged, so that Lassoing a red-marked question doesn't leave it in the Red ink list too.
22. As a student, I want deleting an Entry from the Revision log screen not to bring its red ink back into the list, so that something I deleted on purpose doesn't nag me.
23. As a student, I want red strokes added later near a logged Red mark to make a new Red mark, so that a second attempt at the same question can be logged on its own.
24. As a student, I want erasing red ink never to delete or change an Entry, so that the log stays a real record.

### PDF of a Revision log

25. As a student, I want an Export PDF button on a course's Revision log screen, so that I can print or share the log.
26. As a student, I want the PDF to follow the screen's filter (all, Mistakes or Key points) and its newest-first order, so that I can export only Key points before an exam.
27. As a student, I want each Entry in the PDF to show its back Snip (zoomed to the box for Entries from Red marks), its Document, page and date, its kind, its category and its "why", so that the paper version is useful without the app.
28. As a student, I want the PDF on A4 portrait pages with as many Entries per page as fit, and no Entry split across two pages, so that it prints cleanly.
29. As a student, I want the PDF written to `<course> revision log.pdf` in the Course folder, replacing the last export, and then a Share sheet, so that it syncs with the course and I can send it straight away.
30. As a student, I want exporting an empty log or filter to tell me there is nothing to export instead of writing an empty file, so that I don't share a blank PDF.
31. As a student, I want a clear message if the PDF can't be written, with the old export left whole, so that a failure never leaves a broken file.

## Implementation Decisions

### Seams

Four seams in `core`, tested on the JVM with a real temporary folder and a fake clock. Rendering, the PDF writer and the Compose screens are thin adapters in `app`.

1. **Red marks** (new, pure): finds a Document's Red marks.
2. **Document session** (existing): gains Not a mistake.
3. **Revision log session** (existing): Entries gain the red strokes they came from and a box; deleted Entries leave their strokes behind.
4. **Log PDF layout** (new, pure): decides which Entries go on which page.

### Red marks

- Input: the Document's strokes, the time now, and the stroke IDs to leave out (logged in the Revision log or hidden in the Ink file). Output: the Red marks, each with its page, its stroke IDs and its box in page points, in page order then by time.
- Only pen strokes whose colour is the red pen's count. The highlighter never does, whatever its colour.
- Grouping, per page, taking the strokes in the order they were drawn: a stroke joins the current group when it was drawn within the time limit after the group's last stroke and its box is within the distance limit of the group's box. Otherwise it starts a new group. Both limits are named constants: 60 seconds, and a distance of one fifth of the page's shorter side.
- A group is a Red mark only when its last stroke was drawn more than 60 seconds before now. Left-out strokes are removed before grouping, so ink added later beside a logged Red mark makes a new one (story 23).
- The `app` recomputes the Red marks off the main thread when the strokes change and once a minute while a Document is open.

### Document session: Not a mistake

- New operation: hide these stroke IDs as not a mistake. It saves like any change. It isn't an undo step, as Not a mistake is a list action, not an edit of the page.
- The Ink file gains an optional list of hidden stroke IDs. An older file has none. An older app ignores the field, so it isn't a new format version, as for the Notebook field.
- Hidden IDs of strokes that were later erased stay in the list; they do no harm.

### Revision log session

- An Entry gains two optional fields: the red stroke IDs it came from, and a box in page points that it opens zoomed to. Entries from Red marks have both. Entries from the Lasso have the red stroke IDs inside the loop and no box. Older Entries have neither.
- The log gains a list of stroke IDs from deleted Entries. Delete moves the Entry's red stroke IDs there. Like the deleted Entry's Snips, they stay so a restored Version stays consistent.
- New query: every logged red stroke ID for one Document, from its Entries and from deleted ones. Together with the Ink file's hidden IDs, that is what Red marks leaves out.
- Adding from a Red mark uses the existing add with the source area set to the whole page, plus the stroke IDs and box. Snips are written before the Entry, as now.
- These are new optional fields, read by older apps as unknown and ignored, so `revision_log.json` keeps its format version. An older app saving the log would drop them; that is accepted, as both apps are never in use together.

### Snips and zooming (`app`)

- An Entry from a Red mark renders the whole page twice, as the Snip adapter does for a Lasso area: front with the page and its Pictures, back with ink as well and the box outlined. The long edge is capped as now.
- Review, the Entry screen and the Red ink list's small pictures open zoomed to the box with a margin, and allow pinch to zoom out. Entries without a box show as now.
- The Red ink list's row pictures are rendered on demand at small size and not saved.

### Log PDF layout

- Input: the Entries in the screen's order and filter, each with its Snip's size in pixels, and the A4 page size, margins and text block height as named constants. Output: pages, each a list of placed Entries with the Snip's drawn rectangle and the label lines.
- A Snip is scaled to fit the page width and a maximum height (half the printable height), keeping its shape. For an Entry with a box, the Snip is cropped to the box with the same margin as on screen.
- Entries are placed top to bottom; one that doesn't fit on what is left of a page starts the next page. An empty input is an error the screen turns into story 30's message.
- The `app` draws the pages with Android's PDF writer, writes them with the safe write to `<course> revision log.pdf` in the Course folder, then opens the Share sheet. The export runs off the main thread with a progress indicator. The tree shows the PDF like any other Document.

### Logging

- Log Red marks found (count only), Mistake added from a Red mark, Not a mistake (count of strokes), and PDF exported (Entry count, page count, size in bytes) or failed. Never log Snips, strokes or "why" text.

## Testing Decisions

- **What makes a good test:** it drives a seam the way the app does and checks what I would notice: what's offered, what's on disk, what reopens. No tests of private functions.
- **Red marks tests** (new, pure, prior art: `LassoTest`): strokes within the time and distance limits make one Red mark; a stroke past either limit starts another; marks on different pages stay separate; a group whose last stroke is under a minute old isn't offered; highlighter and other pens never count; left-out strokes are skipped and new ink beside them makes a new mark; the milestone's done-when case, three red marks on two pages, gives three Red marks.
- **Document session tests** (prior art: `DocumentSessionTest`): Not a mistake survives reopening; an Ink file without the field opens with none hidden.
- **Revision log session tests** (prior art: `RevisionLogSessionTest`): an Entry with stroke IDs and a box reopens with them; deleting it keeps its stroke IDs among the logged ones; the logged IDs are per Document; an old log without the fields opens.
- **Log PDF layout tests** (new, pure): Entries fill a page and the next starts a new page; no Entry is split; a tall Snip is capped; an Entry with a box is cropped to it; the filter and order are kept; an empty list is refused.
- **Not unit-tested:** Snip rendering, the badge, the list and the PDF drawing. Each ticket lists an on-tablet check in the Preview app, including opening the exported PDF in another reader.

## Out of Scope

- Adding Entries without a tap, or a reminder on closing a Document.
- Other colours as Key points or anything else.
- Including Redos or Review history in the PDF.
- Choosing which Entries to export beyond the screen's filter.
- Exporting Documents with their ink (milestone 6).
- Snips sent from milestone 7 to the Revision log.

## Further Notes

- **Effect on the main spec:** stories 74–83 are replaced by this file. Milestone 5 is now "Red ink and log PDF"; its done-when test becomes: "3 red marks on 2 pages show as 3 rows in the Red ink list; adding them makes 3 Mistakes and they aren't offered again; Not a mistake hides one for good; Export PDF writes a PDF that opens in another reader."
- The distance limit is a first guess; check it on real tutorial pages in the first ticket and tune the constant if marks merge or split wrongly.
