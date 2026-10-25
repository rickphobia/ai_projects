# Legado's web-service replies

`LegadoClientTest` serves these files as Legado's web service would, so a change to the format Gloss reads fails a test.

**Not yet recorded on the phone.** They are written in the format of Legado's `ReturnData` and `Book` (`{isSuccess, errorMsg, data}`, with the `durChapter*` fields), because the phone was offline on Tailscale when they were made. Replace each with the real reply, recorded with the Web service and Tailscale on:

```bash
curl -s http://100.87.90.10:1122/getBookshelf > bookshelf.json
curl -s "http://100.87.90.10:1122/getBookContent?url=<book URL, URL-encoded>&index=<durChapterIndex>" > chapter-local-epub.json
```

Before committing a recording, remove request signatures and tokens from book URLs, and cut a chapter to a few paragraphs. The tests name the books and passages they expect, so update them to match.

| File | What it is |
|------|------------|
| `bookshelf.json` | `/getBookshelf`: an online book, a local EPUB read most recently, and a book never opened (`durChapterTime` 0) |
| `chapter-local-epub.json` | `/getBookContent` for the local EPUB's current chapter |
| `chapter-online.json` | `/getBookContent` for the online book's current chapter |
| `chapter-permission-denial.json` | `/getBookContent` when Legado has lost its grant to the EPUB's folder |
