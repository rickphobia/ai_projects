# RickNotes

An Android tablet app for studying lecture and tutorial PDFs with a pen, with a red-pen error log that fills itself.

## Files

**Study folder**:
The one folder of courses, chapters and PDFs that the app shows. The app is a window onto it and keeps no library of its own.
_Avoid_: vault, library, workspace

**Course folder**:
The folder for one course, such as `Y1/Sem1/EE2001`. Folders three levels inside the Study folder are Course folders, and any folder can be marked or unmarked as one by hand. Each Course folder has its own Revision log.
_Avoid_: subject, module

**Document**:
A PDF in the Study folder, opened for reading and writing on. The PDF itself is never changed.
_Avoid_: note, file (when the PDF is meant)

**Notebook**:
A Document the app created itself: a new PDF of blank A4 portrait pages with a blank, lined, grid or dotted background. Once created it is a Document like any other.
_Avoid_: canvas, board, blank PDF

**Ink file**:
The file beside a Document that holds everything drawn or pasted on it: strokes and Pictures.
_Avoid_: annotations, overlay, notes file

**Recent Documents**:
The last 8 Documents opened, newest first, shown as a row at the top of the home screen.
_Avoid_: history, recents list

**Document session**:
The app's hold on one Document's ink while it is open: it loads the Ink file, keeps the strokes, and saves them back. One per Document, even when it is open in two Tabs.
_Avoid_: editor, controller

**Version**:
One earlier copy of an Ink file, kept so it can be restored. One is taken when a Document is opened and at most every 15 minutes of writing after that.
_Avoid_: backup, snapshot

**Conflict copy**:
A second copy of a file made by the sync app when both sides changed it. RickNotes warns about it and never merges it.
_Avoid_: duplicate

**Inserted page**:
A blank A4 page added between a Document's pages, with a blank, lined, grid or dotted background. It lives only in the Ink file; the PDF is never changed. Only inserted pages can be removed.
_Avoid_: extra page, blank page

**Office file**:
A pptx or docx in the Study folder. It can't be opened, only converted into a Document.

**Orphaned ink**:
An Ink file whose PDF is missing, usually because the PDF was renamed or moved outside the app.

## Writing on a page

**Stroke**:
One continuous pen or highlighter line, from pen down to pen up.
_Avoid_: line, path, mark

**Red ink**:
Strokes drawn with the red pen. Red ink means "I got this wrong".
_Avoid_: correction, annotation

**Finger erase**:
An optional setting, off by default, where one finger on the page erases whole strokes instead of scrolling. Two fingers always scroll and zoom.
_Avoid_: touch eraser, palm mode

**Resting hand**:
A palm or the side of a hand on the screen while writing. The app ignores it: it never scrolls, marks or erases. A finger counts as one if it lands while the pen hovers or touches or just after, or if its contact is wider than a fingertip.
_Avoid_: palm mode, touch rejection

**Favourite pens**:
The short list of pen colours that tapping the current pen in the toolbar cycles through.

**Lasso**:
The tool that draws a loop around part of a page. The loop selects your own strokes to move or delete them, and can also be cut out as a Snip to add to a Revision log.
_Avoid_: select tool

**Picture**:
An image placed on a page, such as a dropped screenshot, drawn over the page and under the ink. Its image is kept in the Document's `.assets` folder and it is recorded in the Ink file; the PDF is never changed.
_Avoid_: image, attachment, sticker

**Snip**:
A picture cut out of part of a rendered page, including the slide and any ink on it, from a Lasso loop or the Snip tool. A snip can be pasted, added to a Revision log, or shared to another app.
_Avoid_: clip, crop, screenshot, region, lasso

**Preset**:
A named prompt, such as "Answer only" or "Chapter overview", sent along with a Document or snip to the Gemini or Claude app.
_Avoid_: template, mode

## Revision log

**Revision log**:
One course's list of things to revise: Mistakes to redo and Key points to remember. It lives in its Course folder.
_Avoid_: error log, correction book, mistake book, error_logs.pdf

**Entry**:
One item in a Revision log: a Snip of where it came from, labelled with Document, page and date, with an optional category and "why" line. Every Entry is either a Mistake or a Key point.
_Avoid_: error, record, card

**Mistake**:
An Entry for something you got wrong or didn't understand. It comes back in Review, where you write a Redo.
_Avoid_: Wrong entry, Confused entry

**Key point**:
An Entry for something important the lecturer said. It comes back in Review like a Mistake, with no Redo.
_Avoid_: highlight, note

**Redo**:
One attempt at a Mistake again, written by hand on a blank area under its front in Review. Optional.
_Avoid_: retry, review

**Review**:
Going through every Entry due today, from every Revision log, one card at a time: its front (the Snip without ink), then Show answer for its back (with ink and the "why" line), then Again or Good.
_Avoid_: quiz, study session, flashcards

**Due**:
An Entry is due when its due date is today or earlier. It is first due 3 days after it was added; Good stretches the gap 2.3 times (3, 7, 16, 37 days); Again makes it due tomorrow and starts the stretching over.
_Avoid_: overdue, scheduled

## Screen

**Pane**:
One side of the split view, holding one or more Tabs. There are at most two.
_Avoid_: window, split, editor

**Divider**:
The line between two Panes. Dragging it resizes them; its position is saved with the Layout.
_Avoid_: splitter, separator

**Focused Pane**:
The Pane last touched. A Document opened from the home screen or the tree drawer goes there.
_Avoid_: active pane, current pane

**Tab**:
One open Document inside a Pane.

**Layout**:
The Panes, their Tabs with each Tab's page and zoom, and which Tab each Pane shows. Saved so it comes back after a restart.
_Avoid_: workspace, session

## Building it

**Milestone**:
One step of the build order, done only when its "done when" test passes on the tablet with the owner holding the pen. A milestone is made of several tickets.
_Avoid_: phase, release

**Preview app**:
The separate "RickNotes Preview" app that a pull request's build installs as, pointed at a copy of the Study folder. The real notes are only ever opened by "RickNotes".
_Avoid_: demo, test build, beta
