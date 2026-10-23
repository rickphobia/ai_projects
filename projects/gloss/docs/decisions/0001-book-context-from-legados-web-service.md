# Book context from Legado's web service

Android's text-selection menu hands Gloss only the selected text, not which book it came from. Gloss gets the Book context from Legado's own web service on `127.0.0.1:1122`: `/getBookshelf` gives the book read most recently (highest `durChapterTime`) with its chapter and position, and `/getBookContent` gives that chapter's text. Tested on the owner's phone on 2026-10-23: both work, for online books and for a local EPUB once the book has been opened in Legado. Without the web service, or when the Selection isn't in that chapter, Gloss answers from the Selection alone.

**Considered Options:**

- **A fork of Legado with the feature built in.** Legado's repo was emptied in 2026 after legal action over copyright infringement, so there is no upstream to follow, and a fork carries that baggage.
- **Reading the EPUB file directly** with a one-time folder grant. Works without Legado's web service, but only for local books and needs the chapter-to-file mapping Legado already does; kept as a fallback if Legado's own folder grant goes missing (it did once: "Permission Denial").
- **An accessibility service reading the screen.** Gets only what's visible, Legado draws its text itself, and Play Protect blocks sideloaded apps asking for accessibility.

**Trade-offs:** the web service must be on while reading, and while it is, anyone on the same Wi-Fi can read the bookshelf and edit book sources (Legado has no local-only setting). On Wi-Fi the owner doesn't control (campus, cafés) the owner switches the web service off, or reads on mobile data; Gloss then answers without Book context. Warning about untrusted Wi-Fi from inside Gloss was rejected: reading the network name needs the location permission. The API is undocumented now that the repo is gone, so a Legado update could change it.
