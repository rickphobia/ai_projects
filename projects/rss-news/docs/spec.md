# rss-news spec

## Problem Statement

The owner follows a lot of news: AI releases and what researchers, analysts and Reddit think of them; world events like wars, outbreaks and disasters; macro news like the Fed; news about the stocks they hold or watch; Malaysian news; and tech news. Reading every Item is too much, so most days they only want about ten minutes of overview and then open the few Items that interest them.

They used oksskolten, an AI RSS reader, but it uses a lot of RAM, and it is designed for reading full articles inside the app rather than for a short overview first. They want their own app on the Beelink that costs well under 100 USD a month in Claude API calls.

## Solution

rss-news is a private, single-user PWA on the Beelink at `rickphobia.com/ai-projects/rss-news/`.

- **Collecting:** it collects Items from Sources (feeds, subreddits, newsletters, ticker news) that the owner puts in Folders.
- **Scoring on arrival:** a cheap model gives every new Item an Importance score and a one-line summary.
- **Briefings on request:** when the owner presses a button, a stronger model writes a Briefing for the scope they chose: all Sources or one Folder over 24 hours, 7 days or 30 days, or a set of Items picked by hand. Each point links to its Items.
- **Inbox and Chat:** the Inbox lists every Item. A Chat docked in the Inbox answers questions such as "what happened in Malaysia" with matching Items, each with a one-line summary, a Source button that opens the Item, and a button to turn them into a Briefing.
- **Simple summary:** a Summarise button in the Item view explains the whole Item in plain words: a one-sentence gist and a few short points.
- **Selecting text:** a popup offers Ask AI (opens the Chat with the selection), Note, or a short Dictionary definition.
- **Alerts:** push notifications to the owner's Android phone for Items about their Watchlist stocks, and for Importance 5 Items.
- **Spending:** every AI call is logged with its cost, and a monthly spending limit protects the budget.

## User Stories

### Signing in

1. As the owner, I want to sign in with one password, so that nobody else can read my Watchlist or spend my API budget.
2. As the owner, I want to stay signed in on my phone for weeks, so that I don't type the password every morning.
3. As the owner, I want repeated wrong passwords to be slowed down, so that the public login page can't be brute-forced.
4. As the owner, I want every page and API call except the login page and the health check to need a signed-in session, so that nothing leaks.

### Sources and Folders

5. As the owner, I want the approved starter Sources loaded on first run, so that the app is useful immediately.
6. As the owner, I want to add a Source by pasting a feed URL, so that I can follow new sites.
7. As the owner, I want to add a subreddit by name, so that I don't have to know Reddit's feed URL format.
8. As the owner, I want to create, rename and delete Folders, so that I can group Sources my own way.
9. As the owner, I want to move a Source to another Folder, so that I can fix where its Items appear.
10. As the owner, I want to pause or remove a Source, so that noisy Sources stop filling my Inbox.
11. As the owner, I want to see when each Source last fetched successfully and its last error, so that I notice broken feeds.
12. As the owner, I want feeds checked regularly without hammering sites, so that the app is a polite client and doesn't get blocked.
13. As the owner, I want Reddit requests spaced out and Reddit's "retry later" answers respected, so that Reddit keeps serving us.
14. As the owner, I want the same story arriving twice with different tracking parameters to appear once, so that the Inbox has no duplicates.

### Newsletters

15. As the owner, I want newsletters sent to a dedicated Gmail address to arrive as Items, so that email-only newsletters sit next to my feeds.
16. As the owner, I want each newsletter sender to become its own Source automatically, so that I can put each newsletter in a Folder.
17. As the owner, I want new newsletter Sources to land in a "Newsletters" Folder until I move them, so that nothing gets lost.

### Watchlist and ticker news

18. As the owner, I want to put the stocks I own on the Watchlist myself, so that no brokerage token is stored on the server.
19. As the owner, I want to add and remove Watchlist stocks in the app, so that I can follow stocks I don't own.
20. As the owner, I want both US tickers and Bursa `.KL` tickers to work, so that I can buy Malaysian stocks later.
21. As the owner, I want each Watchlist stock to get its own ticker-news Source in the Stocks Folder automatically, so that I get company news without setting it up.
22. As the owner, I want a sold stock's ticker Source to stop when it leaves my Watchlist, so that old stocks don't clutter my Inbox.

### Importance and one-line summaries

23. As the owner, I want every new Item to get an Importance from 1 to 5, so that I can see what matters first.
24. As the owner, I want every new Item to get a one-line summary in English, so that I can scan the Inbox quickly.
25. As the owner, I want Malay-language Items summarised in English with a link to the original, so that I can follow Malaysian news.
26. As the owner, I want each Item marked with the Watchlist stocks it mentions, so that stock news is easy to find and can trigger Alerts.
27. As the owner, I want scoring to use the cheapest model in batches, so that it costs a few dollars a month.

### Inbox

28. As the owner, I want an Inbox listing all Items newest first, with their one-line summary, Source, time and Importance, so that I can scan everything.
29. As the owner, I want to filter the Inbox by Folder, so that I can read just Malaysia or just AI.
30. As the owner, I want to sort or filter the Inbox by Importance, so that I can skip minor Items.
31. As the owner, I want unread Items marked, and an Item marked read only when I scroll on past the end of it, so that opening or swiping through Items doesn't lose them.
32. As the owner, I want to search my Items by keyword, so that I can find something I saw last week.
33. As the owner, I want to tick several Items and press "Brief these", so that I get a Briefing on exactly those Items.

### Reading an Item

34. As the owner, I want to open an Item and see its one-line summary, Source, time and a button to the original page, so that I can decide whether to read more.
35. As the owner, I want the full article shown in Reader view, without ads or clutter, as soon as I open an Item, so that I can read it in the app without jumping to the original site.
36. As the owner, I want Reader view to fetch the article only when I open that Item and not keep a copy, so that the app stays small.
37. As the owner, I want a clear message when Reader view can't extract a page, with the original link, so that I'm never stuck.

### Briefings

38. As the owner, I want Brief me as one compact, always-visible bar at the top of the Inbox (Brief [scope] over [window] [Brief me (about $X)]) that links to the Briefing it writes on the Briefings screen, so that briefing is one tap away and the list stays near the top.
39. As the owner, I want a "Brief me" button for all Sources over the last 24 hours, so that the usual case is one tap.
40. As the owner, I want to choose a 24 hour, 7 day or 30 day window, so that I can catch up after a few days away.
41. As the owner, I want to brief one Folder only, so that I can get just the Malaysia or AI picture.
42. As the owner, I want the button to show the estimated cost before I press it, so that I'm never surprised by a 30 day Briefing.
43. As the owner, I want a Briefing grouped by Folder, with each point linking to the Items it came from, so that I can open the source of anything interesting.
44. As the owner, I want 7 day and 30 day Briefings built only from Items with Importance 3 or higher, so that they stay focused and affordable.
45. As the owner, I want every Briefing saved and listed, so that I can reread earlier ones.
46. As the owner, I want pressing the same Briefing again on the same day to show the saved one, with a Regenerate button, so that a double tap doesn't cost money twice.
47. As the owner, I want to see progress while a Briefing is written, so that I know it's working.
48. As the owner, I want a clear error and no charge-and-lose if a Briefing fails halfway, so that I can retry.

### Chat

49. As the owner, I want a Chat docked in the Inbox (a side panel on desktop, a bottom sheet on my phone), so that I can ask about my news.
50. As the owner, I want to ask "what happened in Malaysia" and get the matching Items, each with a one-line summary and a Source button that opens that Item, so that I can drill in.
51. As the owner, I want a "Brief these" button under a Chat answer, so that I can turn those Items into a Briefing.
52. As the owner, I want the Chat to assume the last 24 hours when I don't name a time, and say which window and how many Items it used, so that I know what I'm looking at.
53. As the owner, I want to say "this week" or "since Monday" and have the Chat use that window, up to 90 days back, so that I can look further back.
54. As the owner, I want the Chat to answer from my Items first and search the web only when I ask or my Items have nothing, telling me when it did, so that answers stay grounded and cheap.
55. As the owner, I want follow-up questions to remember the conversation, so that I can dig deeper.
56. As the owner, I want long conversations to be compacted automatically, so that they keep working and stay affordable.
57. As the owner, I want earlier Chats saved and listed, so that I can come back to them.

### Selecting text

58. As the owner, I want selecting text in a Briefing, Item or Chat answer to show a popup with Ask AI, Note and Dictionary, so that I can act on what I read.
59. As the owner, I want Ask AI to open the Chat with my selection and where it came from, so that the AI knows what I'm asking about.
60. As the owner, I want Note to save the selection with an optional comment and a link back, so that I can keep things I want to remember.
61. As the owner, I want Dictionary to show a short definition that fits the surrounding text, including jargon, tickers and Malay words, so that I understand without leaving the page.

### Notes

62. As the owner, I want a Notes page listing my Notes newest first with a link back to their source, so that I can find them again.
63. As the owner, I want to edit a Note's comment and delete a Note, so that I can tidy them.
64. As the owner, I want to export my Notes as Markdown, so that I can keep them elsewhere.

### Alerts

65. As the owner, I want a push Alert when an Item mentions one of my Watchlist stocks, so that I hear about my money quickly.
66. As the owner, I want a push Alert when an Item scores Importance 5, so that I hear about wars, disasters, Fed decisions or big model releases quickly.
67. As the owner, I want no Alerts during quiet hours (23:00 to 07:00 by default), so that I can sleep.
68. As the owner, I want at most 10 Alerts a day by default, so that a busy news day can't flood my phone.
69. As the owner, I want tapping an Alert to open that Item, so that I can read it straight away.
70. As the owner, I want one Alert per Item even if it matches several rules, so that I'm not notified twice.
71. As the owner, I want to turn Alerts on for my phone from the settings page and send a test Alert, so that I know they work.

### Installing on the phone

72. As the owner, I want to install the app to my Android home screen, so that it feels like an app.
73. As the owner, I want long-press shortcuts on the app icon for "Brief me (24h)", "Chat" and "Notes", so that common actions are one tap.
74. As the owner, I want the README to explain the Honor battery setting that lets Alerts arrive on time, so that MagicOS doesn't delay them.

### Spending

75. As the owner, I want every AI call logged with its model, tokens, cost and duration, so that I can see where the money goes.
76. As the owner, I want a spending page showing this month's cost by feature (scoring, Briefings, Chat, Dictionary, web search), so that I can tune the setup.
77. As the owner, I want a warning in the app at 80% of the monthly limit, so that I can slow down.
78. As the owner, I want Briefings, Chat and Dictionary to stop at 100% of the limit with a clear message, while scoring and Alerts keep running, so that the budget holds and important news still reaches me.
79. As the owner, I want to change the AI models in config without touching code, so that I can switch Briefings to Sonnet if Opus costs too much.

### Keeping things tidy

80. As the owner, I want Items older than 90 days deleted automatically, so that the database stays small.
81. As the owner, I want Briefings, Chats and Notes kept until I delete them, so that I keep what I care about.

### Running it

82. As the owner, I want the app to run as one Docker container on the Beelink using under 300MB of RAM, so that it doesn't starve my other services.
83. As the owner, I want a health check that reports the database and how long ago the last tick ran, so that I can tell when it's stuck.
84. As the owner, I want structured logs that name the Source, step and outside call that failed, so that I can debug without re-running.
85. As the owner, I want to deploy with the same `deploy/update-site.sh` and `deploy/rollback.sh` pattern as my other projects, so that releases work the same everywhere.
86. As the owner, I want the README to take a new machine from clone to running, so that I can rebuild the server.

### Look and feel

87. As the owner, I want a clean, calm design like oksskolten's (a Folder sidebar, a tidy Inbox list, a centred reading column), so that the app is pleasant to open every day.
88. As the owner, I want light and dark themes that follow my phone's setting, so that reading at night doesn't glare.
89. As the owner, I want the layout to work one-handed on my phone, with the Folder sidebar as a drawer, and to use the extra room on a wide screen, so that it suits both.
90. As the owner, I want each Inbox row to show the title, the one-line summary, the Source, the time and the Importance at a glance, so that I can skim without opening Items.
91. As the owner, I want a small thumbnail on Inbox rows when the feed provides one, so that I can recognise stories faster.
92. As the owner, I want each Inbox row to stand apart as its own card with a bold title, and a Contents panel listing the loaded Items that jumps to the one I pick, so that a long Inbox is easy to scan and move around.
93. As the owner, I want each Briefing point to be a short headline sentence, a plain-words (ELI5) explanation and a one-sentence conclusion, so that I understand stories outside my expertise without opening them.
94. As the owner, I want each Briefing point to stand apart as a card with its first sentence in bold, only a few Source links until I ask for more, and a Folder strip that jumps to each section, so that a long Briefing is easy to read and move around.
95. As the owner, I want the browser's Back and Forward (and my phone's back gesture) to move between screens like a normal website, coming back to the Inbox where I left it, so that I don't have to find my way Home each time.
96. As the owner, I want Reader view to work for Reddit posts and newsletters (the linked article, or the post or email itself), so that most Items read in the app instead of showing only a preview.
97. As the owner, I want the Inbox to show only unread Items by default, with Unread / Read / All and Latest / Importance toggles at the top, so that the Inbox only holds what I haven't dealt with and I can still find what I've read.
98. As the owner, I want scrolling on past the end of an Item to mark it read and open the next Item of the list I came from (or go back after the last), and a swipe left or right (or the arrow keys) to move to the next or previous Item without marking it, so that I can read through my Inbox without going back to it each time.
99. As the owner, I want the home screen to be only an AI chat box, like oksskolten's: a greeting, a big question box and suggested questions (what's interesting today, a summary of the last 24 hours, a summary of the last 24 hours on a topic I type), so that I start by asking rather than scrolling.
100. As the owner, I want each Item in a Chat answer to show its title as a heading that opens it, a two-or-three-sentence plain-words summary, and its Source, Importance and age, so that the answer reads like a short news digest.
101. As the owner, I want a Summarise button in the Item view that explains the whole Item in plain words, more than one line but far shorter than the article, so that I get the gist of a long or technical piece without reading it all.
102. As the owner, I want a Briefing or a Chat answer to keep being written and saved when I leave the page or lock my phone, so that I don't have to wait on the screen for it.
103. As the owner, I want coming back to the app to show a Briefing still being written with its progress ("Writing World (2 of 3)…") or a link to it once done, and a Chat question as "Answering…" and then its answer, so that I can pick up where I left off.
104. As the owner, I want an Alert when a Briefing I started is finished or has failed, which opens the Briefing when tapped, so that I know without checking the app.
105. As the owner, I want pressing Brief me again while that Briefing is being written to follow the one already running, and a Briefing or question lost to a server restart to show as failed rather than hang, so that I'm never charged twice or left waiting forever.

## Implementation Decisions

### Shape

- One Docker container. A Python backend built with uv and FastAPI serves a JSON API, the built PWA and `/healthz`. SQLite lives in one file on a mounted volume, and an in-process scheduler runs the tick. This follows court-booker's decision 0001.
- The PWA is TypeScript with Vite in strict mode. It is built in the Docker image and served by the backend under the path prefix (decision 0002).
- The host nginx forwards `/ai-projects/rss-news/` to the container. Deploy follows `projects/pawn-swarm/deploy/` and court-booker, and the project is added to `scripts/try-pr.sh` for PR previews.
- The business logic does not know about FastAPI, SQLite, Anthropic, IMAP or Web Push. It talks to them through small interfaces (ports) passed in when the app starts.

### Ports (the outside world)

These are the only places that touch the network or the system. Each has one real adapter and one fake for tests.

- **Clock:** the current time in the owner's time zone (`Asia/Kuala_Lumpur` by default).
- **FeedFetcher:** a conditional GET of a URL. It returns not-modified, a body with caching headers, rate-limited with a retry delay, or a failure that includes the step and detail.
- **LanguageModel:** one operation per job: score Items, write a Briefing section, run a Chat turn with tools, and define a word. Each returns the result plus usage (model, input and output tokens, web searches, duration). The real adapter uses the Anthropic SDK with timeouts and retries with backoff. Scoring sends batches of Items in ordinary Messages API calls, not the Batch API (decision 0003).
- **Mailbox:** reads new messages from the newsletter Gmail inbox over IMAP and marks them handled.
- **PushSender:** sends a Web Push message to a stored subscription and reports gone subscriptions.
- **ArticleExtractor:** turns a fetched HTML page into clean text for Reader view and for giving Briefings the full text of selected Items. It uses trafilatura.

### Modules (business logic, grouped by feature)

- **sources:** Folders and Sources, the starter set, deciding which Sources are due, and the polite fetch queue. All requests to one host go one at a time. Reddit requests are spaced 60 seconds apart, with each subreddit checked at most every 60 minutes, and any retry delay the site gives is honoured. Errors back off exponentially, and Sources are never disabled automatically. Parsing turns a feed body into Items and strips tracking parameters, so duplicate Items can be spotted by their cleaned URL.
- **newsletters:** turns Mailbox messages into Items, creating one Source per sender in the "Newsletters" Folder.
- **stocks:** the Watchlist (edited in the app) and keeping one ticker-news Source per stock in the Stocks Folder. Ticker symbols are validated to accept US and `.KL` formats.
- **scoring:** gives new Items an Importance, a one-line English summary and the owner's stocks they mention. It sends unscored Items in batches to the scoring model and stores the results. Items that fail scoring are retried on a later tick and never block the Inbox.
- **items:** the Inbox (filter by Folder, Importance and unread), read state, keyword search using SQLite FTS over title, excerpt and one-line summary, and deleting Items older than 90 days.
- **briefings:** a Briefing request is a scope and an optional window, either `{all Sources | one Folder} × {24h | 7d | 30d}` or `picked Items`.
  - **Selecting Items:** every Item in the window for 24h, and Importance 3 or higher for 7d and 30d.
  - **Writing:** one LanguageModel call per Folder section. Each call gets the one-line summaries plus full text for the top Items, fetched through ArticleExtractor and cut to fit, and stays under the 40K-token budget. The sections are then joined into one saved Briefing. Each point refers to Item IDs, and the app turns those into links.
  - **Estimated cost:** worked out from the selected Items and the configured per-model prices, without calling the model.
  - **Reuse:** asking for the same scope and window on the same day returns the saved Briefing unless Regenerate is asked for.
  - **Failure:** a failed section fails the whole Briefing. Nothing half-written is saved, and the cost already spent is still recorded.
- **chat:** Chats and their messages. The model gets a `search_items` tool (Folder, time window, keyword, minimum Importance, defaulting to the last 24 hours) and web search, capped at 5 uses per question.
  - **Answers** are structured: an intro line naming the window and Item count, then a list of `{item_id, one-line summary}`. The PWA renders a Source button for each Item ID and a "Brief these" button.
  - **Item IDs are checked:** any ID that isn't a real Item is dropped.
  - **Web search** is offered only when the owner asks for it, or when `search_items` finds nothing. The answer is flagged when it was used.
  - **Compaction:** once a Chat's context passes a configured threshold (70K by default), the server-side compaction feature summarises older messages.
  - **Selected text:** when the owner brings it in from a Briefing, Item or Note, it is attached as quoted context with its origin.
- **dictionary:** one cheap-model call with the selected word or phrase and the text around it, returning a short definition.
- **notes:** Notes (selection, optional comment, link back to a Briefing, Item or Chat), listing, editing, deleting and exporting as Markdown.
- **alerts:**
  - **When:** after a tick scores new Items, an Item qualifies if it mentions a Watchlist stock, or has Importance 5.
  - **Limits:** each Item gets at most one Alert, none are sent during quiet hours, and at most 10 are sent per day. Quiet hours and the daily cap are set in config.
  - **What happens to blocked Alerts:** an Alert blocked by quiet hours or the cap is not sent later. The Item still shows in the Inbox.
  - **Push subscriptions** are stored. Gone subscriptions are removed, and a test Alert can be sent.
- **spending:** a ledger with one row per AI call, recording feature, model, tokens, web searches, cost and duration. It gives the month-to-date total, the total per feature and the limit status: ok, warning at 80%, or stopped at 100%. Briefings, Chat, Simple summaries and Dictionary check the status before calling and refuse with a clear error when stopped. Scoring is never stopped.
- **auth:** one password, set as a hash in config, with signed session cookies and slowed-down repeated failures. This follows court-booker's auth module.
- **tick:** one function the scheduler calls every minute, which runs in order:
  1. fetch due Sources
  2. read the Mailbox
  3. score new Items
  4. send Alerts
  5. delete old Items

  It records the time of the last successful tick for `/healthz`. Each step's failure is logged and doesn't stop the later steps.

### Config

One config module validates every setting at startup and fails with a clear message when something is missing. Secrets come only from environment variables:

- the Anthropic API key
- the Gmail address and app password
- the VAPID private key for Web Push (the public key is worked out from it). It is optional: without it Alerts are off and say so, and the rest of the app runs (decision 0005)
- the session secret
- the password hash

Other settings:

- models per job (scoring, Briefing, Chat, Simple summary, Dictionary) and the price per million tokens for each model
- price per web search
- monthly limit
- time zone
- quiet hours and the daily Alert cap
- Reddit spacing and interval
- Briefing token budget and Importance cut-off
- Chat compaction threshold
- how long Items are kept
- path prefix
- database path

Defaults:

| Job | Model |
|---|---|
| Scoring | `claude-haiku-5-5` |
| Briefings | `claude-opus-5-5` at low effort |
| Chat | `claude-opus-5-5` |
| Simple summary | `claude-haiku-5-5` |
| Dictionary | `claude-haiku-5-5` |

The monthly limit defaults to 100 USD.

### API (JSON, under the path prefix)

| Area | Endpoints |
|---|---|
| Session | login, logout |
| Folders, Sources | list, create, update, delete. Source health is included when listing |
| Stocks | Watchlist (list, add, remove) |
| Inbox | list with filters and paging, search, mark read |
| Items | show one; Reader view (fetches and extracts when the Item is opened); Simple summary (written when asked, not kept) |
| Briefings | latest, estimate, create (runs as a job and returns its progress as server-sent events; a `regenerate` flag writes a new one even when today's is saved; pressing again while that scope is written joins the running job), list, show |
| Chats | list, create, send message (runs as a job, streamed; 409 while the Chat is still answering), show |
| Jobs | follow a Briefing or Chat answer job again by its id, from the start (404 once the server no longer knows it, such as after a restart; decision 0007) |
| Dictionary | look up |
| Notes | list, create, update, delete, export as Markdown |
| Push | set-up (whether Alerts are available, and the public key), subscribe, unsubscribe, send test Alert |
| Spending | this month's summary |
| Health | `/healthz` (no login) |

### PWA

- **Screens:**
  - login
  - home (latest Briefing and the "Brief me" controls with estimated cost)
  - Briefings list
  - Inbox with the Chat panel
  - Item view (summary, original link, Reader view loaded on open)
  - Notes
  - Sources and Folders
  - Stocks
  - Settings (Alerts, quiet hours display, spending)
- **Design:** one shared stylesheet of colour, spacing and type tokens with a light and a dark set picked by `prefers-color-scheme`; every screen uses it. No UI framework: the PWA stays plain TypeScript. oksskolten's screenshots are the visual reference. Thumbnails are the image link the feed itself gives (no page fetch); the picture loads from the original site and is never stored.
- **Selection popup:** appears on selected text in Briefings, Items and Chat answers.
- **Service worker:** caches the app shell, receives push messages and opens the Item (or, for a finished Briefing, the Briefing) when an Alert is tapped.
- **Running jobs:** the PWA remembers in the browser's storage the job of a Briefing or Chat question it started, and follows it again when the owner comes back.
- **Manifest:** installable, with app shortcuts for "Brief me (24h)", "Chat" and "Notes".
- **Backend calls:** all go through one API client module. It is the PWA's seam for tests.

### Logging and observability

- JSON logs with levels, as court-booker does.
- Every outside call logs the port, target (Source ID or host, never full content), result and duration.
- AI calls also log model, tokens, cost, retries and the feature that made the call.
- Secrets, email bodies and session cookies are never logged.

## Testing Decisions

- **What makes a good test:** it drives the app through its public surface and checks what the owner would see: API responses, saved Briefings, Alerts sent through the fake PushSender, and ledger totals. It never checks private functions or SQL. A refactor that keeps behaviour the same must not break a test. Bugs get a failing test that reproduces them first.
- **Seam 1, the backend HTTP API (most tests):**
  - **Setup:** the app is built with real SQLite in a temporary folder and fakes for Clock, FeedFetcher, LanguageModel, Mailbox, PushSender and ArticleExtractor. Tests drive it through FastAPI's `TestClient` and call the tick directly. Prior art is court-booker's `tests/support.py`, `tests/web/test_app.py` and `tests/scheduler/`.
  - **Fake model:** it returns scripted results and usage, so the spending ledger and limits can be tested exactly.
  - **Covers:** fetching and duplicates, Reddit spacing and retry delays, newsletters, scoring retries, Inbox filters and search, Briefing scopes, selection, cost estimate, reuse and failure, Chat window defaults, Item ID checking and web search policy, Notes, Alert rules, quiet hours and the daily cap, the spending limit, deleting old Items, auth and `/healthz`.
- **Seam 2, the real adapters, against saved files only:**
  - **Feed parsing:** saved RSS, Atom and Reddit feeds, including one from each starter Source family.
  - **Mailbox:** a saved newsletter email.
  - **LanguageModel:** saved Anthropic responses, covering scoring, a Briefing section, a Chat turn with tool use, web search results and a refusal.
  - **ArticleExtractor:** a saved article page.
  - No test touches the live network. Prior art is court-booker's `tests/adapters/picktime_browser/` with its saved HTML page.
- **Seam 3, the PWA screens:**
  - **Setup:** Vitest and Testing Library, against a fake API client.
  - **Covers:** the selection popup and its three actions, a Chat answer's Source buttons opening the Item, "Brief these", the Briefing cost display and Regenerate, Inbox filters, and the Alert opt-in.
  - Prior art is pawn-swarm's Vitest setup.
- **Seam 4, the Docker smoke test:**
  - **Steps:** build the image, start it with dummy settings and fakes turned off, check that `/healthz` answers and that the PWA loads under the prefix, then check that the container's memory stays under 300MB after start-up and one tick against a local fixture server.
  - Prior art is court-booker's `scripts/docker-smoke-test.sh`.
- **CI:** `.github/workflows/rss-news.yml` runs ruff, a type check (mypy in strict mode), pytest, eslint, prettier, `tsc` and Vitest, then the smoke test.

## Out of Scope

- X (Twitter) as a Source.
- A native Android home-screen widget (a FeedMe-style scrolling list of the latest Items). It needs the PWA wrapped as a Trusted Web Activity and is a later ticket.
- Keyword-based Alerts.
- More than one user or account.
- Briefings written on a schedule. Briefings are only written when the owner asks.
- Storing full article text, and full-text search over article bodies.
- Reading stocks from a broker such as IBKR. The owner adds the stocks they own to the Watchlist by hand (dropped on 2026-10-13, so no brokerage token sits on the server).
- Sending Notes to RickNotes.
- Importing or exporting OPML.
- Translating whole articles. Only the one-line summaries and Briefings are in English.

## Further Notes

- **Cost estimate** for about 500 new Items a day: scoring about $3 a month, Briefings $0.15 to $0.40 each, and Chat $0.05 to $0.10 per question at Opus 5.5 prices ($4 / $20 per million tokens). Haiku 5.5 costs $0.10 / $0.50 per million tokens up to 100K-token prompts and 5× that above, so scoring batches must stay under 100K tokens per request. Prices are from the API reference as cached on 2026-10-06, and they live in config.
- **Starter Sources:** `docs/starter-sources.md` lists the approved starter Sources and the gaps found while testing them: Anthropic, The Star, BLS and AAAS have no usable feed.
- **Reddit:** anonymous RSS works but is rate-limited (with 10 seconds between requests most were refused with 429; 60 seconds lets a dozen subreddits through each round), and the JSON API returns 403 without OAuth. If RSS access stops working, the fallback is a Reddit OAuth app behind the same FeedFetcher port.
- **Chrome on Android doesn't support widgets for PWAs.** That's why the widget waits for the Trusted Web Activity ticket.
- **oksskolten** is a reference for ideas only (decision 0001): its smart fetching and Chat tools.
