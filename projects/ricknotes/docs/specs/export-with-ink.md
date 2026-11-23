# RickNotes — Export with ink

Owner: @rickphobia · 2026-11-01 · Settles milestone 6 of `docs/spec.md` after its grilling. Words in **bold** on first use are defined in `GLOSSARY.md`. Where this file and the main spec's stories 49 and 84–87 differ, this file wins; see "Effect on the main spec" at the end.

## Problem Statement

My ink lives in the **Ink file** beside each PDF, so only RickNotes can see it:

- **The AI never sees my working.** Send to shares the bare PDF. When I ask Claude for a Hint or a Full explanation, it can't see how far I got or where my working went wrong, though those **Presets** are marked ink on.
- **I can't get my notes out.** To print a tutorial I've worked on, or send it to a friend, I have no PDF that has my ink in it.
- **Versions waste their slots.** A **Version** is taken on every open, even when nothing changed, so going home and back a few times pushes yesterday's Versions out, and nothing says how to get old ink back.

## Solution

- **Export with ink.** The last row of the Send to menu makes an **Export**: a new PDF of the whole **Document** with its pages kept sharp (the slide text stays selectable), its **Inserted pages**, **Pictures** and strokes drawn in, under the Document's own name. It opens the Share sheet, so I can save it to Drive, print it or send it anywhere. No copy is kept in the Study folder, and the PDF itself is never changed.
- **The Preset decides.** A Preset marked ink on sends an Export instead of the bare PDF; each row says "with ink" or "no ink". With Both Panes, each Document goes with its own ink.
- **Getting old ink back.** Versions are no longer taken when nothing changed. There is still no screen for them: old ink comes back through Drive's own version history, with `.versions` on the tablet as the last resort, both written up in the README.

## User Stories

### Export with ink

1. As a student, I want "Export with ink" as the last row of the Send to menu, so that I can share or print a Document with my ink without hunting for a new button.
2. As a student, I want the Export to have every page of the Document in order, Inserted pages included with their backgrounds, so that it matches what I see in the app.
3. As a student, I want my pen strokes, highlighter (still see-through) and Pictures drawn on the Export where they are on the page, red ink included, so that it looks like my screen.
4. As a student, I want the PDF's own pages kept as they are, with sharp, selectable text, so that the Export is small, prints well and the AI can read the slide text.
5. As a student, I want the Export named like the Document (`Week 3 tutorial.pdf`), so that whoever receives it knows what it is.
6. As a student, I want Export with ink to open the Share sheet and keep no copy in the Study folder, so that the tree isn't cluttered with copies I could write on twice.
7. As a student, I want Export with ink on a Document with no ink to share the bare PDF, so that it always does something sensible.
8. As a student, I want a progress bar with Cancel while a long Document is exported, so that a 100-page lecture doesn't look frozen and I can stop it.
9. As a student, I want a clear message if the Export can't be made, with nothing shared, so that I never send a broken or half-drawn PDF.
10. As a student, I want ink I write after starting an Export left out of it rather than half in, so that the Export is always one consistent moment.

### Send to with ink

11. As a student, I want a Preset marked ink on to send an Export of the Document, and one marked ink off to send the bare PDF, so that the AI sees my working only when it helps.
12. As a student, I want each Preset row to say "with ink" or "no ink", replacing "(ink comes with export)", so that I know what is about to go.
13. As a student, I want Both Panes with an ink-on Preset to export each Document with its own ink and send both in one share, in the same order as today, so that the lecture and my tutorial working arrive together.
14. As a student, I want a send with ink to wait for the Export behind the same progress bar, then share, so that the AI app never gets a half-written file.
15. As a student, I want Cancel or a failed Export during a send to share nothing and leave the prompt off the clipboard, so that I don't paste a prompt with no PDF.

### When the ink can't be used

16. As a student, I want Export with ink on a Document whose Ink file can't be read to say "Ink can't be read, so it can't be exported" and point to Getting old ink back, so that I know why and what to do.
17. As a student, I want an ink-on Preset on such a Document to send the bare PDF with a note that the ink was left out, so that a damaged Ink file doesn't stop me asking for help.
18. As a student, I want Export with ink, or an ink-on Preset, on a Document waiting on Keep mine or Keep the other to ask me to pick first, so that it's never unclear which ink went.

### Versions

19. As a student, I want no Version taken on open when the Ink file hasn't changed since the newest Version, so that the 10 kept are 10 different moments, not copies of the last hour.
20. As a student, I want a README section "Getting old ink back", with steps for Drive's Manage versions first and the `.versions` folder as the last resort, so that I can undo a disaster without a screen in the app.
21. As a student, I want the read-only warning for a damaged Ink file to point to Getting old ink back, so that the way out is named where I hit the problem.

## Implementation Decisions

### Seams

- **Export plan** (new, pure, in `core`, like the Log PDF layout): given a Document session's state and whether ink is wanted, it decides what goes. It reads the session's page list, strokes and Pictures (a snapshot taken at the start, story 10) and the PDF's page sizes, and gives one of:
  - **Bare**: ink not wanted, or the Document has no strokes, Pictures or Inserted pages.
  - **With ink**: the pages in order, each a PDF page (by its index) or an Inserted page (A4 portrait, with its background), with the Pictures and strokes to draw on it in PDF points, Pictures under strokes, strokes in the order written, each with its tool, colour and width.
  - **Ink unreadable**: the Ink file is damaged.
  - **Pick a side first**: a Conflict copy is waiting on Keep mine or Keep the other.
- Export with ink always asks for ink; Send to asks for it when the Preset is ink on. Both Panes asks for one plan per Document.
- **Document session** (existing): the Version on open is skipped when the Ink file's bytes equal the newest Version's. The 15-minute Version while writing is unchanged.

### Drawing the Export

- The `app` draws a With ink plan into a new PDF. How is decided in the first ticket, which compares the ways that keep the PDF's own pages as they are (a maintained PDF library, or Android's newer PDF editing APIs on the tablet's Android 16) and records the choice as decision record 0008, with its licence and the APK size it adds. Turning every page into a picture is only the fallback, and needs the owner's agreement first.
- Strokes are drawn as vector shapes made with the same brushes as on screen, so the Export looks the same; the highlighter keeps its see-through colour. Pictures come from the Document's `.assets` folder. Inserted pages are drawn with their blank, lined, grid or dotted background.
- The Export is written to a folder in the app's cache, emptied before each new Export, with the file named like the Document (each Document of Both Panes in its own subfolder, so two same-named PDFs don't clash). It is shared through the app's existing file provider, readable only by the app it goes to. A cancelled or failed Export deletes its partial file.
- It runs off the main thread behind a progress bar (pages done of all) with Cancel, as the Log PDF export does.

### Send to menu

- Export with ink is the last row, below the Gemini and Claude Presets, and shares through the full Share sheet. With Both Panes chosen, it exports the Document Send to was opened from.
- Preset rows show "with ink" or "no ink" from the Preset's ink-on setting. The Presets file is unchanged. There is no "Include my ink" switch.
- With ink, the prompt goes on the clipboard only once the Export is ready, just before the share.

### Getting old ink back

- A README section with the steps: close the Document on the tablet; in Drive on a laptop, open Manage versions on its `.ink.json` and download yesterday's; put it back over the Ink file in Drive; let FolderSync bring it down before opening the Document. The last resort: copy a file from the `.versions` folder beside it over the Ink file on the tablet.
- The damaged-Ink-file warning names the section.
- The README's lines saying a restore screen comes in milestone 6 are corrected in the same ticket.

### Logging

- Log each Export: page count, how many were Inserted pages, stroke and Picture counts, time taken and size in bytes, and whether it was for Send to or the Share sheet. Log a cancel, a failure with the step that failed, and a refusal (Ink unreadable or Pick a side first). Never log strokes, Picture images, file names or prompts.
- Log a skipped Version on open as a debug line.

## Testing Decisions

- **What makes a good test:** it gives the Export plan a Document session's state as the app would and checks what it decides. No tests of private functions or of the drawing.
- **Export plan tests** (prior art: `LogPdfLayoutTest`): ink off gives Bare; no ink gives Bare; strokes, Pictures and Inserted pages come out on the right pages in order, with Inserted pages A4 and their backgrounds; Pictures come before strokes; the highlighter keeps its tool; a damaged Ink file gives Ink unreadable; a waiting Conflict copy gives Pick a side first; a stroke added after the snapshot is not in the plan.
- **Document session tests** (prior art: `DocumentSessionTest`, with `FakeClock`): opening twice with no change takes one Version; opening after a change takes a second; the 15-minute Version while writing still comes.
- **Not unit-tested:** the PDF drawing, the progress bar, the Share sheet and the Send to rows. Each ticket lists an on-tablet check in the Preview app, including opening the Export in another reader with the slide text selectable, and sending with Hint to Claude.

## Out of Scope

- A screen to list, preview or restore Versions (main spec stories 85–86), unless the Drive check below fails.
- Restoring a Revision log from a Version.
- Exporting part of a Document, or several Documents into one PDF.
- An "Include my ink" switch, or changing a Preset's ink setting from the app.
- Exporting Snips (milestone 8).
- Saving an Export into the Study folder.

## Further Notes

- **To check, not assumed:** that Drive keeps a version history for `.ink.json` files FolderSync uploads. FolderSync must update the Drive file in place; if it deletes and re-uploads, Drive keeps no history. Google documents that versions of non-Google files may be deleted after 30 days or once there are 100 newer ones, unless marked "Keep forever". The check: write on a Document, wait for a sync, open Manage versions on its `.ink.json` in Drive on a laptop. The owner does it before the Getting old ink back ticket is built, and that ticket repeats it on the tablet. If Drive keeps no history, the Version list comes back for grilling.
- **Effect on the main spec:** stories 84 and 87 are replaced by this file; stories 85 and 86 are dropped; story 49's "offer to restore a Version" becomes "point to Getting old ink back". Milestone 6 is now "Export with ink"; its done-when test becomes: "A tutorial exported with ink opens in another reader with the ink, Pictures and Inserted pages there and the slide text still selectable; sent to Claude with Hint, it arrives with ink; an Ink file from yesterday comes back from Drive's Manage versions by following the README."
