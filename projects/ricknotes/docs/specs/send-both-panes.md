# RickNotes — Send both Panes

Owner: @rickphobia · 2026-10-30 · Extends Send to (`docs/specs/milestones-3-4.md`, stories 29–33) after its grilling. Words in **bold** on first use are defined in `GLOSSARY.md`.

## Problem Statement

Step 2 of my tutorial routine sends the lecture slides and the tutorial to Gemini in one message, so the overview can map each concept to the tutorial questions. Send to shares one **Document** at a time, so today I send one, then add the other by hand in the Gemini app. The AI app also opens full screen over RickNotes, so I lose sight of the Documents I'm asking about.

## Solution

- **Both Panes.** When the two **Panes** show two different PDFs, Send to asks first: **This Document** or **Both Panes** (*Lecture 3* + *Tutorial 3*). Both Panes shares the two PDFs in one share to the Gemini or Claude app, with the chosen **Preset**'s prompt on the clipboard as now.
- **A Preset for it.** "Overview with tutorial" asks for a chapter overview of the lecture that maps each concept to the tutorial questions using it. I add it to my Presets file by hand.
- **Beside RickNotes.** Every send opens the AI app in split screen next to RickNotes, so the Documents stay in view.

## User Stories

1. As a student, I want Send to to offer This Document or Both Panes when the two Panes show two different PDFs, so that I can send the lecture and the tutorial in one message.
2. As a student, I want Both Panes to show the two Documents' names, so that I know what I'm about to send.
3. As a student, I want no Both Panes choice when there is one Pane, when both Panes show the same PDF, or when the other Pane's Document is missing, so that I'm never offered something that can't be sent.
4. As a student, I want every Preset available with Both Panes, so that I can also ask for a Hint with the lecture beside the question.
5. As a student, I want Both Panes to send the two PDFs in one share, with the Document I opened Send to from first, so that the AI app gets both in one new chat.
6. As a student, I want the Preset's prompt on the clipboard before the share, as for one Document, so that I paste it once.
7. As a student, I want Both Panes to fall back to the full share menu when the target app isn't installed, as for one Document, so that Send to always does something.
8. As a student, I want Presets marked ink on to still say "(ink comes with export)", so that I know both PDFs go without my ink.
9. As a student, I want every send, of one Document or both, to open the Gemini or Claude app in split screen beside RickNotes, so that I can read the answer next to the Documents.
10. As a student, I want the send to still work when the tablet doesn't split the screen, opening the app full screen as today, so that Send to never fails because of the window.
11. As a student, I want an "Overview with tutorial" Preset whose prompt is written in the README, so that I can paste it into my Presets file.

## Implementation Decisions

### Seam

- One seam, the existing **Layout** in `core`: a new query gives, for a Pane, the Document shown in the other Pane when Both Panes is possible: there are two Panes, their selected Tabs are different Documents, and the other one isn't missing. Otherwise none. The Document screen asks it with its own Pane.
- The share and the window are thin `app` adapters, checked on the tablet.

### Send to menu

- When the query gives a Document, the menu shows a This Document / Both Panes choice above the targets, This Document selected each time it opens. The Both Panes label names both Documents by file name without `.pdf`.
- The targets and Presets below it are unchanged. Every Preset can go with either choice; the Presets file gains no field.

### The share

- One Document: `ACTION_SEND` as now. Both Panes: `ACTION_SEND_MULTIPLE` with both content URIs in `EXTRA_STREAM`, in the order of story 5, both in `ClipData` with read permission for those two URIs only, type `application/pdf`.
- Checked on the tablet on 2026-10-30, sharing two PDFs from a file manager: the Gemini and Claude apps both accept two PDFs in one share and start a new chat with both attached. Android doesn't promise the order, so the prompt never relies on it.
- Not installed: the full share menu with the same intent, as now.

### Split screen

- Every direct send adds `FLAG_ACTIVITY_LAUNCH_ADJACENT` with `FLAG_ACTIVITY_NEW_TASK`. Android documents this as best effort on large screens from Android 12L; where the tablet ignores it, the app opens full screen as today, and that is not an error.
- The fallback share menu opens as now; the flag goes only on the direct send, as the share menu is a sheet over RickNotes.
- A floating window was considered and dropped: Android only honours a launch size in desktop windowing mode, and the tablet's own floating window can't be asked for by an app.

### Presets

- Prompts carry the full instructions. Gemini Gems become read-only on 17 November 2026 and are removed on 17 December 2026, replaced by skills; a share can't open a chat inside either, and the same Preset must work for Claude.
- The Presets file is never written once it exists, so "Overview with tutorial" is added to the Default Presets for new files and given in the README for pasting by hand. Ink off. Its prompt:

  > One PDF is lecture slides and the other is the tutorial for the same topic; tell them apart by their content. Give me a chapter overview of the lecture: list the major concepts; under each, the smaller concepts; for each smaller concept, an explain-like-I'm-five explanation, the key formula, and the tutorial questions that use it, by their number in the tutorial. Then list any tutorial question that no concept covers. Use the notation on the slides. Do not solve the tutorial questions.

### Logging

- Log the target, the Preset name and how many Documents went (1 or 2). Never the prompt or the Document names.

## Testing Decisions

- **What makes a good test:** it drives the Layout the way the Document screen does and checks what Send to would offer. No tests of private functions.
- **Layout tests** (prior art: `LayoutTest`): two Panes with different Documents give the other Pane's Document, from either Pane; one Pane, the same Document in both, or a missing other Document give none.
- **Presets tests** (prior art: `PresetsFileTest`): a new Presets file has "Overview with tutorial", ink off.
- **Not unit-tested:** the menu, the share intents and split screen. The ticket lists an on-tablet check in the Preview app.

## Out of Scope

- Sending more than two Documents, or Tabs that aren't the selected one in each Pane.
- Sending Snips (milestone 7) or Documents with ink (milestone 6).
- Opening a chat inside a Gemini Gem or skill.
- A floating window, or a setting to choose how the AI app opens.
- Adding new Default Presets to an existing Presets file.

## Further Notes

- **Ticket 38's tablet check**, done 2026-10-30 once the Send to crash was fixed (PR #316): both apps open a new chat with the PDF attached, the pasted prompt goes in, and a share made while a chat is open starts a new chat. Recorded in the README.
