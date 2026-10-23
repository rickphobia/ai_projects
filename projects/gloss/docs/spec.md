# Gloss: spec

## Problem Statement

The owner reads English books (local EPUBs such as *Crime and Punishment*) in Legado on an Android phone. When a word or sentence isn't clear, the options are poor: Legado's selection menu offers "Ask Claude", "Ask Gemini" and "Translate", but each opens a full app, takes the owner off the page, and knows nothing about the book: not the title, not the chapter, not what happened before. Every question has to be typed out with its background, and the answer may give away the plot. There is also nowhere to jot a thought about a passage and find it again later.

## Solution

Gloss adds three entries to Android's text-selection menu, which Legado lists: **Define**, **Explain** and **Note**. Each opens a card at the bottom of the screen over the book; tapping outside closes it and the owner is back on the page.

- **Define** gives the meaning of the Selection as it is used in this sentence, in a line or two, using what the book has said so far.
- **Explain** gives a short, simple (ELI5) paragraph about what a sentence or passage means, and takes follow-up questions.
- **Note** saves the owner's own thoughts about the Selection, with no AI.

Gloss knows the book because Legado's web service tells it which book is open and gives it the chapter's text (decision 0001). Answers never use anything past the owner's reading position. Every Lookup and Note is kept on a Book page, and a book's Notes and Lookups can be shared as Markdown. The AI runs on the owner's own Anthropic key, inside a monthly Spending limit.

## Build order

1. **Milestone 1: Define.** The card, Define with Book context, the key, Settings and the Spending limit. Usable every day in Legado from here.
2. **Milestone 2: Explain.** Explain with follow-ups, and Define's "Explain more".
3. **Milestone 3: Notes and Book pages.** Note from the menu and from the card, the Books screen, Book pages, Recent and Markdown export.

## User Stories

### Getting the app

1. As the owner, I want to install Gloss from GitHub Releases through Obtainium and get updates there, so that I don't build it myself.
2. As the owner, I want every pull request to have a Preview APK that installs beside Gloss, so that I can try a change before merging it.
3. As the owner, I want Gloss to ask for no special permissions (no notification, SMS, accessibility, location or "draw over other apps" access), so that Play Protect lets it install and nothing about it is invasive.

### Setting up (milestone 1)

4. As the owner, I want Gloss's first screen to ask for my Anthropic API key, so that it can call the AI.
5. As the owner, I want the key checked with a small test call when I save it, so that a typo is caught at once and not on my first Define.
6. As the owner, I want the key stored encrypted on the phone and never backed up, so that it can't leak.
7. As the owner, I want "Change key" in Settings, so that I can replace it.
8. As the owner, I want the first screen to tell me to switch on Legado's Web service (Me → Web service) and to show whether Gloss can reach it right now, so that Book context works from the first Define.
9. As the owner, I want the first screen to explain that Define, Explain and Note appear in the selection menu (sometimes under ⋮ or "More"), so that I know where to find them.

### Define (milestone 1)

10. As the owner, I want to select a word or phrase in Legado and tap Define, so that its meaning appears over the page without leaving the book.
11. As the owner, I want Define to give only the meaning in this sentence, in one or two short, plain lines, so that I can read it at a glance.
12. As the owner, I want Define to use the book, the author, the chapter and the text before my Selection, including references and allusions, so that the meaning fits this book and not a generic dictionary sense.
13. As the owner, I want Define on a whole sentence to give that sentence's meaning in a line or two, so that the button I tapped is the one that runs.
14. As the owner, I want the card to show the Selection, the book and the chapter it used, so that I can see what the answer was based on.
15. As the owner, I want a loading state in the card while the AI answers, so that I know it's working.
16. As the owner, I want tapping outside the card or pressing back to close it and return me to the same place in Legado, so that reading isn't interrupted.
17. As the owner, I want the card to follow the phone's dark mode, so that it doesn't flash white at night.

### Book context (milestone 1)

18. As the owner, I want Gloss to use the book I read most recently in Legado, so that it knows which book my Selection came from.
19. As the owner, I want Book context used only when my Selection is actually found in that book's current chapter, so that a word I select in Chrome isn't explained as if it were from my novel.
20. As the owner, I want a Selection that appears more than once in the chapter matched to the occurrence nearest my reading position, so that the right sentence is used.
21. As the owner, I want small differences between Legado's screen and its chapter text (spacing, line breaks, curly versus straight quotes) ignored when matching, so that matching doesn't fail on formatting.
22. As the owner, I want at most about 3,000 words of the chapter before my Selection sent, plus the rest of the Selection's paragraph, so that answers have enough context and each Lookup stays cheap.
23. As the owner, I want answers never to use or reveal anything past my reading position, even for famous books the AI already knows, so that nothing is spoiled.
24. As the owner, I want Gloss to answer from the Selection alone, with a small "No book context" line, when Legado's Web service is off, unreachable, slow, or the Selection isn't in the chapter, so that a lookup never fails for lack of context.
25. As the owner, I want "No book context" to say why in a few words ("Legado's Web service is off", "Not found in the chapter"), so that I know whether to fix anything.
26. As the owner, I want Gloss to give up on Legado after a short wait and answer without Book context, so that a slow Legado doesn't hold up the card.
27. As the owner, I want Define, Explain and Note to work from any app's selection menu, without Book context outside Legado, so that I can use them anywhere.

### Spending limit (milestone 1)

28. As the owner, I want a monthly Spending limit, $10 at first and changeable in Settings, so that Gloss can't run up a bill.
29. As the owner, I want Settings to show this month's spend ("$0.84 of $10 this month"), so that I know where I stand.
30. As the owner, I want a small warning line in the card once this month's spend passes 80% of the limit, so that I'm not surprised when it stops.
31. As the owner, I want Gloss to stop calling the AI once the limit is reached, and the card to say so with the date it resets, so that the limit is a real limit.
32. As the owner, I want a failed AI call that still cost money counted toward the limit, so that the total is honest.

### Failures (milestone 1)

33. As the owner, I want a clear message and a Retry button in the card when there's no internet, the AI is down or the AI rejects the key, so that I can try again without selecting the text again.
34. As the owner, I want a rejected key to point me to "Change key", so that I can fix it.
35. As the owner, I want Settings to have "Share log" with a rolling log of what Gloss did (Legado reachable, Book context found or why not, model, tokens, latency, cost, errors), without my Selections, answers or Notes, so that problems can be debugged without exposing what I read or wrote.

### Explain (milestone 2)

36. As the owner, I want to select a sentence or passage and tap Explain, so that I get what it means in plain words over the page.
37. As the owner, I want Explain's first answer to be a short ELI5 paragraph covering the meaning and any idiom, irony, slang or reference in it, so that I understand it quickly.
38. As the owner, I want Explain on a single word to explain that word in context the same short, simple way, so that the button I tapped is the one that runs.
39. As the owner, I want to type follow-up questions under the answer ("why is he so nervous?", "what's a garret?") and get answers with the same Book context, so that I can dig into the passage.
40. As the owner, I want the card to grow to full height when a chat gets long, and to scroll, so that follow-ups fit.
41. As the owner, I want follow-ups to keep the Spoiler line, so that a follow-up can't spoil either.
42. As the owner, I want an "Explain more" button on a Define card that turns the same Selection into an Explain chat, so that one line isn't the end when it isn't enough.

### Notes (milestone 3)

43. As the owner, I want to select text and tap Note, so that I can write my own thoughts about a passage over the page.
44. As the owner, I want the Note card to show the Selection with a text box and Save, so that writing a Note is quick.
45. As the owner, I want a Note saved with its book and chapter when there is Book context, and under "No book" otherwise, so that I can find it again.
46. As the owner, I want a Note button on Define and Explain cards that attaches my Note to that Lookup, so that my thought sits next to the answer it's about.
47. As the owner, I want a Note never sent to the AI, so that my own thoughts stay private and cost nothing.
48. As the owner, I want an unsaved Note kept if the card closes by accident, until I save or discard it, so that I don't lose what I wrote.

### Book pages and Recent (milestone 3)

49. As the owner, I want every Lookup saved, including whole Explain chats, so that I can look back at what I asked.
50. As the owner, I want a Books screen listing every book I've looked up or noted in, most recent first, so that I can open a book's page.
51. As the owner, I want a Book page showing that book's Notes and Lookups in reading order by chapter, so that it reads like my margin notes for the book.
52. As the owner, I want a Recent list of my latest Lookups and Notes across all books, so that I can find "that word from yesterday" without remembering the book.
53. As the owner, I want to open a past Lookup and read its whole chat, so that I can revisit an explanation.
54. As the owner, I want to edit and delete Notes, and delete Lookups, on the Book page, so that I can keep it tidy.
55. As the owner, I want a "No book" page for Lookups and Notes made without Book context, so that they aren't lost.
56. As the owner, I want a Share button on each Book page that exports its Notes and Lookups as a Markdown file through Android's share sheet, so that I can keep them in Drive, Obsidian or email.

### Reading on public Wi-Fi

57. As the owner, I want the README to explain that while Legado's Web service is on, anyone on the same Wi-Fi can read my bookshelf and edit my book sources, and to advise switching it off (or using mobile data) on Wi-Fi I don't control, such as USM's, so that I can decide safely.
58. As the owner, I want the README to recommend setting up Legado's WebDav backup once, so that a book source changed by someone else can be restored.

## Implementation Decisions

### Platform and distribution

- Native Kotlin and Jetpack Compose, minimum Android 10 (API 29), targeting the newest stable SDK; the first ticket looks up and records current stable versions rather than assuming them. duit-log in this repo is the model for the build setup: copy from it, never reference it.
- Two variants from one codebase: **Gloss** from `main` and **Gloss Preview** from pull requests, with different application IDs, so each has its own key, Lookups and Notes. Both add their own menu entries; the Preview's are labelled so they can be told apart.
- CI (`name: gloss`, scoped to the project folder) runs ktlint, detekt, Android lint, the JVM tests and a signed release build. On `main`, a new version name publishes a GitHub Release `gloss-v<version>` with the APK (Obtainium filter `^gloss-v[0-9.]+$`); green PRs publish a `gloss-pr-<N>` prerelease with the Preview APK, deleted when the PR closes. The version code is the CI run number.
- One release signing key, kept outside the repo with a backup and in CI as a secret. The project is added to the repo's root index and its Obtainium instructions go in the README.

### Module layout

- **`core`**: pure Kotlin, no Android imports. The Gloss core (Seam 1): Book context, the Spoiler line, prompts, the Spending limit, Lookups, Notes, Book pages, Recent and the Markdown export. It talks to the outside world only through ports.
- **`app`**: the Android module with thin adapters: the selection-menu activity and its card, the Legado client, the Anthropic client, storage, encrypted key storage, the rolling log, and the Compose screens (first run, Settings, Books, Book page, Recent).

### Seam 1: the Gloss core

One entry point the card and screens use; tests drive it with fakes for every port.

- **Ports:** Legado (most recent book with its chapter index, chapter title and position; a chapter's text), AI (Define and Explain calls, returning text plus token usage, or a failure that may carry usage), storage (Lookups, chat turns, Notes, monthly spend), a clock, and the settings (limit, models, prices).
- **Define(Selection)**, **Explain(Selection)**, **Follow-up(Lookup, question)**, **Explain more(Lookup)**: each returns what the card shows: the answer, the Book context used (book, chapter) or the reason there is none, the 80% warning when due, or a failure (no network, AI error, rejected key, limit reached with its reset date), and saves the Lookup and its turns.
- **Note(Selection, text)** and **Note on a Lookup**: save a Note with the Selection's Book context, or under "No book".
- **Book context rule:** ask Legado for the most recent book (highest `durChapterTime`), fetch its current chapter, normalise both texts (whitespace, line breaks, quote and dash styles) and find the Selection; when it occurs more than once, take the occurrence nearest the reading position (`durChapterPos`). Found: the context is the book's name and author, the chapter title, and up to about 3,000 words before the Selection plus the rest of its paragraph. Not found, Legado off, or Legado slower than a short timeout: no Book context, with the reason. Nothing from beyond the Selection's paragraph is ever sent.
- **Prompts:** a system prompt with the book, author, chapter and the context text, the rule that nothing past this point may be used or revealed (no plot knowledge from beyond it, even if the model knows the book), and the style: Define gives only the meaning in this sentence in one or two plain lines; Explain gives a short ELI5 paragraph and answers follow-ups briefly. The Book context is marked for prompt caching so follow-ups don't pay for it in full again.
- **Spending limit:** cost is computed from token usage and per-model prices held in the settings; spend is summed per calendar month in the phone's time zone. The limit is checked before every call; at or over it, no call is made. Calls that fail after the model answered still count.
- **Book pages:** books are identified by Legado's book URL (with name and author for display). Book pages list Notes and Lookups by chapter index, then by position in the chapter. Recent lists the newest Lookups and Notes across books. Deleting a Lookup deletes its Notes too, after a confirmation.
- **Markdown export:** one file per book: title and author, then per chapter its Notes and Lookups (Selection as a quote, the answer, follow-ups, Notes), oldest first.

### Seam 2: the Legado adapter

- Talks only to `http://127.0.0.1:1122`: `GET /getBookshelf` and `GET /getBookContent?url=<book URL, URL-encoded>&index=<chapter index>`, both returning `{isSuccess, errorMsg, data}`. Short timeouts; any failure (connection refused, timeout, `isSuccess: false`, malformed JSON) becomes "no Book context" with a reason.
- Tested against responses recorded on the owner's phone on 2026-10-23: the bookshelf (36 books, with request signatures and tokens in book URLs removed), an online chapter, and a local EPUB chapter, plus the "Permission Denial" failure. A Legado update that changes the format then fails a test.
- Legado's port is fixed at 1122 in the settings module, not hard-coded in the logic.

### The AI

- Anthropic's Messages API only (decision: Haiku is about 2–3× cheaper than DeepSeek V4.1 Flash, the one alternative considered). **Define** on Claude Haiku 5.5, **Explain** and follow-ups on Claude Sonnet 5.5; both model names and prices live in the settings module.
- Timeouts, and one retry with backoff on network errors. The log records model, tokens, latency, cost and retries, never the Selection, context, answer or Notes.

### The card (selection-menu activity)

- One translucent activity handles Android's `PROCESS_TEXT` intent, registered three times (Define, Explain, Note) so each is its own menu entry; it never returns replacement text to the calling app. It shows a bottom sheet over the reader, draggable to full height, closed by tapping outside or back.
- An unsaved Note is kept in the activity's saved state and storage until saved or discarded.

### Storage and settings

- Lookups, chat turns, Notes and monthly spend in SQLite on the phone (SQLDelight, as in duit-log), excluded from Android backup along with the key.
- Settings on the device: key (encrypted with an Android Keystore key), Spending limit (default $10), models and prices (defaults built in). No environment variables in the app; CI's signing secrets are listed in the README.

## Testing Decisions

- A good test drives the Gloss core through its entry point and checks what the card would show and what was saved, never internal helpers. Ports are faked: a fake Legado serving canned bookshelves and chapters, a fake AI that records the prompt it was sent and returns canned answers and usage, in-memory storage and a fixed clock.
- **Gloss core (Seam 1)**, JVM tests in `core`: Selection found, found twice (nearest the position), not found, Legado off or slow; the 3,000-word cap and that nothing past the Selection's paragraph reaches the prompt; the spoiler instruction present; Define, Explain, follow-ups and Explain more; the Spending limit (under, at 80%, at the limit, a failed call that still cost money, month rollover in the phone's time zone); Notes alone and on a Lookup, "No book"; Book page order, Recent, deleting, and the Markdown export's exact output.
- **Legado adapter (Seam 2)**: parsing the recorded responses and turning each failure into the right "no Book context" reason.
- The Anthropic client, the card and the screens are thin and checked by hand on the phone, in Legado and in Chrome, recorded in each PR.
- Prior art: duit-log's `core` tests of the Ledger and Notification Reader with recorded notification text, and RickNotes' `core` tests of its Document session seam.

## Out of Scope

- Chinese: definitions, pinyin, translation.
- Anki cards or any review or flashcard feature.
- Pronunciation and text-to-speech.
- AI providers other than Anthropic (DeepSeek and other OpenAI-compatible APIs can be one later ticket).
- Writing Notes back into Legado as bookmarks.
- Reading EPUB files directly when Legado can't serve a chapter (decision 0001's fallback; only if Legado's folder grant problem comes back).
- Warning about untrusted Wi-Fi from inside Gloss (needs the location permission).
- A "spoilers OK" switch.
- Sync, accounts, or a web or desktop version; using Gloss's data from the Beelink.
- Book context from the previous chapter when the Selection is near a chapter's start.

## Further Notes

- Legado's GitHub repo was emptied in 2026 after legal action, so its web-service API is undocumented; everything Gloss relies on was tested on the owner's phone on 2026-10-23 and is pinned by Seam 2's recorded responses.
- A local EPUB served "Permission Denial" until the book was opened in Legado; if it comes back, the README should say to re-open the book or re-import the folder in Legado.
- The owner's phone is reachable from the Beelink over Tailscale at `100.87.90.10:1122` while the Web service and VPN are on, which a session can use to record fresh responses.
