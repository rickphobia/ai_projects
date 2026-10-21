# RickNotes

An Android tablet app for studying lecture and tutorial PDFs with a pen, with a red-pen error log that fills itself.

## Files

**Study folder**:
The one folder of courses, chapters and PDFs that the app shows. The app is a window onto it and keeps no library of its own.
_Avoid_: vault, library, workspace

**Document**:
A PDF in the Study folder, opened for reading and writing on. The PDF itself is never changed.
_Avoid_: note, file (when the PDF is meant)

**Notebook**:
A Document the app created itself: a new PDF of blank A4 portrait pages with a blank, lined, grid or dotted background. Once created it is a Document like any other.
_Avoid_: canvas, board, blank PDF

**Ink file**:
The file beside a Document that holds everything drawn or pasted on it: strokes and placed snips.
_Avoid_: annotations, overlay, notes file

**Document session**:
The app's hold on one Document's ink while it is open: it loads the Ink file, keeps the strokes, and saves them back. One per Document, even when it is open in two Tabs.
_Avoid_: editor, controller

**Version**:
One earlier copy of an Ink file, kept so it can be restored. One is taken when a Document is opened and at most every 15 minutes of writing after that.
_Avoid_: backup, snapshot

**Conflict copy**:
A second copy of a file made by the sync app when both sides changed it. RickNotes warns about it and never merges it.
_Avoid_: duplicate

**Office file**:
A pptx or docx in the Study folder. It can't be opened, only converted into a Document.

**Orphaned ink**:
An Ink file whose PDF is missing, usually because the PDF was renamed or moved outside the app.

## Writing on a page

**Stroke**:
One continuous pen or highlighter line, from pen down to pen up.
_Avoid_: line, path, mark

**Red ink**:
Strokes drawn with the red pen. Red ink means "I got this wrong" and is what the error log collects.
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
The tool that selects your own strokes to move or delete them.
_Avoid_: select tool; never use it for cutting out a picture

**Snip**:
A picture cut out of part of a rendered page, including the slide and any ink on it. A snip can be pasted, sent to the error log, or shared to another app.
_Avoid_: clip, crop, screenshot, region, lasso

**Preset**:
A named prompt, such as "Answer only" or "Chapter overview", sent along with a Document or snip to the Gemini or Claude app.
_Avoid_: template, mode

## Error log

**Error log**:
The running list of mistakes and confusions across all courses, kept in the `_error_log` folder.
_Avoid_: mistake book, error_logs.pdf

**Entry**:
One item in the error log: a picture of where it happened (the whole page for a Wrong entry, the snip for a Confused entry), labelled with course, Document, page and date, plus a category, a "why" line and redo dates.
_Avoid_: error, record, card

**Wrong entry**:
An entry made from a group of red ink: something you got wrong.

**Confused entry**:
An entry made from a snip sent to the error log: something you didn't understand.

## Screen

**Pane**:
One side of the split view, holding one or more tabs.
_Avoid_: window, split, editor

**Tab**:
One open Document inside a pane.

## Building it

**Milestone**:
One step of the build order, done only when its "done when" test passes on the tablet with the owner holding the pen. A milestone is made of several tickets.
_Avoid_: phase, release

**Preview app**:
The separate "RickNotes Preview" app that a pull request's build installs as, pointed at a copy of the Study folder. The real notes are only ever opened by "RickNotes".
_Avoid_: demo, test build, beta
