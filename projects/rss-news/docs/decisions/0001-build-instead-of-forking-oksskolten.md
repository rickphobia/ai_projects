# Build our own instead of forking oksskolten

rss-news is close to [oksskolten](https://github.com/babarot/oksskolten) (an AI RSS reader), but it is built from scratch and only borrows its ideas. oksskolten is designed for reading full articles inside the app, which needs full-text extraction, Meilisearch and summaries one article at a time. rss-news shows a Briefing first and links out to the original Items. A fork would mean removing oksskolten's biggest parts, fitting its layout to this repo's structure, and keeping AGPL-3.0 code.

**Trade-offs:** we write feed fetching, the PWA and login ourselves instead of getting them on day one.
