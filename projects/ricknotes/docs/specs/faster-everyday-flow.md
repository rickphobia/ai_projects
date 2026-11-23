# RickNotes — Faster everyday flow (milestone 7, part 1)

Owner: @rickphobia · 2026-11-24 · The first part of milestone 7, Simple UI, settled in its grilling. Words in **bold** on first use are defined in `GLOSSARY.md`. Where this file and the main spec's Send to stories differ, this file wins; see "Effect on the main spec" at the end. Milestone 7's later parts (the cut-over from Nebo, a daily "New today / Due soon" list from `~/ee`, and look and feel) get their own grilling.

## Problem Statement

My everyday study is two setups, and both are slow:

- **Chapter notes with an AI beside them.** I read `~/ee`'s chapter notes instead of the lecture slides. When a page confuses me, getting it to Gemini means sharing the whole PDF and typing where I am.
- **A tutorial checked against its answer pack.** I want the final answers first, to check mine, and when mine differs, a hint about where my working went wrong, not the answer. Today that means finding the answer pack in another folder, opening it, and reading the answers I didn't want to see yet.

Getting the right file to the AI is most of the taps: the answer pack sits in `answer packs/`, the tutorial in `eLearning/<Moodle section>/`, under different names.

## Solution

- **The Gemini app beside RickNotes**, in Android's split screen: RickNotes on one half with one Document, the Gemini Android app on the other. RickNotes builds nothing for this beyond working well at half width; switching between notes and tutorial is switching **Tabs**.
- **Three Presets replace every Preset today**, Claude's included:
  - **Ask about this page** (on notes): sends "I'm reading `<file name>`, page N." and leaves Gemini waiting for my question. Gemini opens the file itself from Drive through its Drive connector.
  - **Answers only** (on a tutorial, test or assignment question sheet): sends its **Answer pack** and chapter notes by name and asks for the final answer to every question, taken from the pack.
  - **Where did I go wrong** (on my working): sends the current page with my ink as a picture, names the Answer pack and chapter notes again, and tells Gemini to find which question I'm on and guide me without giving the answer.
- **The Answer pack and the chapter notes are the absolute reference.** Every Preset names them and tells Gemini to answer, explain and guide only from them: their method, notation and answers, never another method or its own answer.
- **`~/ee` writes a match list** saying which Answer pack and which chapter notes belong to each question sheet, so RickNotes never guesses from names.

## User Stories

1. As a student, I want to read chapter notes in RickNotes with the Gemini app beside it in split screen, so that I can ask about a page without leaving it.
2. As a student, I want RickNotes to work at half the screen's width (tab bar, tools, Send to), so that split screen is usable.
3. As a student, I want "Ask about this page" to send the notes file's exact name and the page I'm on to Gemini, then wait for me to type, so that Gemini reads the right page and I ask what I need.
3a. As a student, I want Gemini told that the chapter notes and Answer packs are the absolute reference, so that it explains with the method and notation I'm taught and never contradicts them.
4. As a student, I want "Answers only" on a question sheet to send its Answer pack and chapter notes to Gemini and get the final answers to the whole sheet, so that I can check my answers without opening the pack.
5. As a student, I want "Answers only" on a sheet with no Answer pack to say "No answer pack yet" and send nothing, so that I never get an unchecked answer by mistake.
6. As a student, I want "Where did I go wrong" to send the page I'm on with my ink as a picture, plus its Answer pack and chapter notes by name, so that Gemini sees my working even in a new chat.
7. As a student, I want Gemini told to find the question from my working and to guide me with hints from the Answer pack's working and the notes' method, never the answer, so that I still work it out myself.
8. As a student, I want the Send to menu to show only these three Presets, so that the choice is quick.
9. As a student, I want each Preset's prompt in `_ricknotes/presets.json`, as today, so that I can reword one on the laptop without a new app.

## Implementation Decisions

### What each Preset sends

- A Preset gains **what it sends**: a **Drive reference** (file names and page number in the prompt text, no file attached), a **page picture** (the current page with its ink, as a PNG), or the PDF as today. The three new Presets are Drive reference, Drive reference, and page picture plus Drive reference.
- **Drive references are exact file names only** (`EEE105 Ch2 Basic Laws notes part 1.pdf`, page 7), never a Drive path: `~/ee`'s names are unique within the courses the tablet mirrors, and the Gemini app's Drive connector finds a file by name. Nothing maps tablet folders to Drive folders.
- The prompt text holds placeholders filled at send time: the Document's file name, the page number shown on screen, and the matched Answer pack's file name.
- **The Answer pack and the chapter notes are the absolute reference** (owner, 24 Nov 2026: the pack is built by Gemini and checked by another model, so its accuracy isn't a worry). Every prompt says so: answers come from the pack, explanations and hints follow the pack's working and the notes' method and notation, and Gemini doesn't bring in another method or check the pack. Ask about this page names the notes file it's on; Answers only and Where did I go wrong name the sheet's Answer pack and its chapter notes, never the sheet: sheet names repeat across courses (EMM101's `Tutorial 1.pdf`), pack and notes names don't, and the page picture shows the question.
- **The pack wins over notes marked NEEDS REVIEW.** Most chapter-notes sets carry `~/ee`'s NEEDS REVIEW header (its checker left items open) and still reach the tablet. The prompts say: where a notes page marked NEEDS REVIEW disagrees with the Answer pack, follow the pack and say so.
- **Where did I go wrong is self-contained:** it repeats the sheet's and the pack's names, so it works whether the Gemini app opens a new chat or continues the last one.
- Sends go to the Gemini Android app with `ACTION_SEND` (text, plus the picture for Where did I go wrong). The Claude target and the Share sheet stay for Export with ink only.

### The match list (`~/ee`)

- One file per course: `~/ee` writes `answer packs/matches.json` inside the course's `_My class 2026-27/`, so it reaches the tablet with the course's own pair. It is live for EBB113, EEE105, EMM101, EUM113 and WAR122 (`~/ee` commit fd68e70, 24 Nov 2026; 21 sheets matched). EEE123 has no `_My class` yet, so no file. It is rewritten whole, under a lock, after any change to `~/ee`'s pack or notes records (build, record, accept, Drive moves, notes builds and rebuilds), and skipped when the bytes haven't changed.
- Format, version 1: `{"version": 1, "sheets": [{"sheet": "<the sheet PDF's path inside _My class 2026-27/>", "pack": "<pack file name>", "notes": ["<chapter-notes file names>"]}]}`. RickNotes looks up the open Document by its path inside its Course folder, which is the same path (`eLearning/05 TUTORIAL/Tutorial #4 … (Question) 2026_2027.pdf`). `sheets` is sorted by sheet path; one pack can appear under several sheets. The file also carries `course`, `session` and `unmatched` (finished packs with no sheet, and why), which RickNotes ignores.
- Only complete packs: a pack in `needs review/` or a `(PREVIEW)` is left out. `notes` holds only files present in `notes/`, NEEDS REVIEW ones included; a pack whose decks have no notes yet has `"notes": []`, and the prompt names only the pack.
- `~/ee` records which sheet each pack was built from and which decks it used: the sheet by MD5 against Drive's own listing, the notes by the decks' SHA-256. It never matches by name or by "Chapter N". Assessment sheets match their `Assessment records/…/questions/` copy this way, which a name join would miss.
- RickNotes reads the file each time Send to opens, like the Presets file. A file that is missing or can't be read means "No answer pack yet" for every sheet, with the reason in the log.

### Presets file

- The Presets file gains a field for what each Preset sends; a Preset without it sends the PDF as today, so an old file still loads.
- The new three are the Default Presets for a new file. An existing `_ricknotes/presets.json` is never rewritten by the app, so the README gives the JSON to paste in on the laptop (an owner step on the ticket).
- Ticket 51 (Presets send with ink, milestone 6) is finished first; this replaces its Presets afterwards.

### Logging

- Log each send: which Preset, what it sent (reference, picture size in bytes), whether a match was found. Never log prompts, file names or pictures.

## Testing Decisions

- **Prompt building** (pure, in `core`): given a Preset, the Document's name, the page and the match list, it gives the text to send, or "No answer pack yet". Tests: each placeholder filled; a sheet with no match refuses; a damaged match list refuses with a reason; an old Presets file without the new field sends the PDF.
- **Match list reading** (prior art: the Presets file tests): valid, missing, not JSON, entry with no pack name, unknown extra keys ignored.
- **`~/ee`'s writer** is tested in `~/ee`, offline (`test_pack_matches.py`).
- **Not unit-tested:** the picture of the page, the share into the Gemini app, half width. Each ticket lists its on-tablet check.

## Out of Scope

- Saved or recent setups (tabs are enough).
- An "Open beside" button for the matched Answer pack.
- Hiding `_My class` files the tablet rarely needs (group lists, front pages, format drafts).
- Gemini inside a RickNotes pane, or the Gemini web app in Chrome.
- The lecturer's own solution PDFs as the reference: Answers only always uses the Answer pack.

## Further Notes

- **To check on the tablet before the tickets are written**, by the owner:
  1. In the Gemini app, type `@Google Drive` with an exact file name (say `EEE105 Ch2 Basic Laws notes part 1.pdf`) and ask about page 7. Pass: Gemini answers from that page. Google documents `@file name` for Gemini *in Drive*; for the Gemini app's Drive connector only third-party pages say it reads PDFs (checked 24 Nov 2026). If it fails, Drive references come back for grilling.
  2. From any app, share a picture with text into the Gemini app. Pass: both arrive in one message. Note whether it starts a new chat.
- **How `~/ee` fits (read 24 Nov 2026):** the 7:17 job downloads eLearning into `_My class/eLearning/`; a new tutorial, quiz, test or assignment sheet gets an Answer pack (built, then re-solved by a second model; complete → `answer packs/`, else `answer packs/needs review/`, which the tablet doesn't mirror); each lecture deck gets chapter notes in `notes/` (`<COURSE> Ch<N> <title> notes.pdf`, split into `part 1`, `part 2` … past 30 pages; a rebuild replaces them under the same names). A pack has one page per question ending in a "Final answers" block. Packs and notes are built separately from the same sources (this year's slides first); nothing checks one against the other, which is why the pack wins where a notes page marked NEEDS REVIEW differs.
- **Done when:** "In split screen with the Gemini app: Ask about this page on a notes page reaches Gemini with the file and page, and Gemini answers about that page; Answers only on EEE105 Tutorial 4 gives the pack's final answers; Where did I go wrong on a page of working gets a hint, not the answer; on a sheet with no pack it says No answer pack yet."
- **Effect on the main spec:** milestone 7's row gets the done-when above for this part. The Default Presets and the Claude Presets are replaced by the three here once ticket 51 is done.
