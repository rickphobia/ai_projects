# rss-news

A personal news briefing for one owner: it reads many Sources (RSS and Atom feeds, subreddits, newsletters, ticker news) and writes a short Briefing on request, so the owner only opens an Item when something catches their interest. To be served at `rickphobia.com/ai-projects/rss-news/`. What it will do is in [`docs/spec.md`](docs/spec.md); the words it uses are in [`GLOSSARY.md`](GLOSSARY.md).

## Status

`in progress`: feeds arrive in the Inbox and get scored. On first run the starter Sources from [`docs/starter-sources.md`](docs/starter-sources.md) are loaded; every minute the server fetches the Sources that are due, stores new Items once each, and has Claude Haiku give each new Item an Importance from 1 to 5 and a one-line English summary. Every AI call is recorded in a spending ledger. The owner signs in with one password and sees the Inbox, newest or most important first, filtered by Folder and Importance, and manages Sources and Folders: add a feed URL or a subreddit, create, rename and delete Folders, move, pause or remove a Source, and see each Source's last success and last error. It installs to the home screen from Chrome, and its service worker caches the app shell (never API answers). Deployable to the Beelink. Fetching is polite: Reddit requests are spaced out, retry delays are honoured and failing Sources back off. The home screen shows the latest Briefing and a Brief me button with its estimated cost: it writes a Briefing of all Sources over the last 24 hours, a section per Folder with each point linking to its Items, and shows the saved one with a Regenerate button when pressed again the same day. No Briefing scopes, history or Chat yet; those are the tickets in [`docs/tickets/`](docs/tickets/).

## Requirements

- [uv](https://docs.astral.sh/uv/) 0.9 or later. It installs the pinned Python (3.13, see `.python-version`) by itself.
- Node.js 24.18 (see `pwa/.nvmrc`; `nvm use` picks it up) and npm, for the PWA.
- Docker, for the image the server runs.
- An Anthropic API key (<https://console.anthropic.com/>) for scoring and Briefings. Scoring about 500 Items a day costs roughly $3 a month, and a Briefing $0.15 to $0.40. You pick the sign-in password at setup.

## Setup

```bash
cd projects/rss-news
uv sync                          # creates .venv with the locked Python dependencies
(cd pwa && npm ci && npm run build)   # installs the PWA's locked dependencies and builds it into pwa/dist
cp .env.example .env
uv run rss-news hash-password    # asks for the password twice; paste the output into RSS_NEWS_PASSWORD_HASH
openssl rand -hex 32             # paste into RSS_NEWS_SESSION_SECRET
# and put your Anthropic API key in RSS_NEWS_ANTHROPIC_API_KEY
```

For a local run over plain http, also set `RSS_NEWS_SECURE_COOKIES=false` in `.env`, or the browser won't send the session cookie back. Every other value is a working default.

## Run

```bash
uv run --env-file .env rss-news serve
curl http://127.0.0.1:8000/ai-projects/rss-news/healthz   # {"status":"ok","database":"ok","last_tick_seconds_ago":12}
```

Then open <http://127.0.0.1:8000/ai-projects/rss-news/> and sign in. The backend serves whatever is in `pwa/dist`, so run `npm run build` in `pwa/` again after changing the PWA.

While working on the PWA, run the backend as above and `npm run dev` in `pwa/` alongside it: Vite serves the PWA with live reload at <http://127.0.0.1:5173/> and forwards `/healthz` and `/api` to the backend.

## Test

```bash
uv run ruff check && uv run ruff format --check && uv run mypy && uv run pytest   # backend
(cd pwa && npm run check)   # PWA: eslint, prettier, tsc and Vitest
```

A single file: `uv run pytest tests/web/test_app.py`, or `npx vitest run tests/screens/shell.test.ts` in `pwa/`. `uv run ruff format` and `npm run format` fix formatting.

CI (`.github/workflows/rss-news.yml`) runs the same commands, `shellcheck` on `scripts/` and `deploy/`, and the Docker smoke test below.

## Docker

```bash
docker build --tag rss-news .
docker run --rm --publish 127.0.0.1:8000:8000 --volume "$PWD/data:/app/data" --env-file .env rss-news
scripts/docker-smoke-test.sh   # builds, starts with dummy settings, checks /healthz, the PWA, sign-in and memory use
```

The image is built in two stages ([decision 0002](docs/decisions/0002-python-api-with-typescript-pwa.md)): a Node stage builds the PWA, and the Python stage runs `rss-news serve` and serves the built files from `/app/pwa`. The database lives in `/app/data`; mount a volume there so it survives new containers. The image runs as an unprivileged user and has a Docker `HEALTHCHECK` on `/healthz`.

The smoke test fails if `/healthz`, the page, its script, the manifest or the service worker don't answer under the prefix, if the database isn't written to the mounted folder, if `/api/session` doesn't answer 401 without a session or the dummy password doesn't sign in, or if the container uses 300MB of RAM or more (the spec's budget).

## Deploy

The app runs as a Docker container on the Beelink, on the shared `homelab_default` network, behind the host nginx (`portfolio-nginx`) at `https://rickphobia.com/ai-projects/rss-news/`. GitHub can't reach the home network, so the server pulls: you run one script there. The scripts are the same as court-booker's.

`deploy/update-site.sh` fetches `main` into `~/homelab/dev/ai_slops`, builds the image `rss-news:<commit>`, loads `deploy/settings.sh` again from that commit, starts a new container with the env file and the data folder mounted at `/app/data` (where the SQLite file lives), and waits up to 60 seconds for `/healthz`. Only then does it give the new container the network name `rss-news` (which nginx proxies to) and remove the old one. If any step fails, the script exits non-zero, names the step, and the old container keeps serving. If `main` hasn't moved and its container is running, it does nothing. The settings both scripts share are in `deploy/settings.sh`.

### One-time setup (on the Beelink)

Needs `git`, `docker` (your user can run it without sudo) and `flock` (already on Ubuntu).

1. **Env file** (the secrets file), outside the repo: `mkdir -p ~/homelab/env && cp projects/rss-news/.env.example ~/homelab/env/rss-news.env && chmod 600 ~/homelab/env/rss-news.env`. The deploy forces `RSS_NEWS_HOST`, `RSS_NEWS_DATABASE_PATH` and `RSS_NEWS_PWA_DIR` to the container's values, so leave the rest as is, except the two sign-in secrets: set `RSS_NEWS_PASSWORD_HASH` to the output of `docker run --rm -it rss-news:<commit> rss-news hash-password` (or `uv run rss-news hash-password` in a checkout), `RSS_NEWS_SESSION_SECRET` to `openssl rand -hex 32` and `RSS_NEWS_ANTHROPIC_API_KEY` to your Anthropic API key. Without them the container won't start. Later tickets add more secrets (such as push keys) to the Configuration table below; put them in this file and never commit them.
2. **Data folder** (the SQLite file, kept across deploys and rollbacks): `mkdir -p ~/homelab/data/rss-news`. The container runs as your user, so it can write there.
3. **nginx.** Save this as `~/homelab/nginx/projects/rss-news.conf` (included inside the existing server block), then check and reload: `docker exec portfolio-nginx nginx -t && docker exec portfolio-nginx nginx -s reload`.

   ```nginx
   # rss-news: proxied to the container on homelab_default.
   location = /ai-projects/rss-news { return 301 https://$host$uri/; }

   # ^~ stops default.conf's regex location for paths ending in / or .html from taking these
   # requests and serving them as static files (a 404 for /ai-projects/rss-news/).
   location ^~ /ai-projects/rss-news/ {
       # Resolve per request, so a missing container is a 502 here, not an nginx that won't start.
       resolver 127.0.0.11 valid=10s;
       set $rss_news_upstream rss-news:8000;
       # No URI part: the app gets the full /ai-projects/rss-news/... path and handles the prefix.
       proxy_pass http://$rss_news_upstream;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto https;
   }
   ```

4. **First deploy:** if `~/homelab/dev/ai_slops` doesn't exist yet, `mkdir -p ~/homelab/dev && git clone https://github.com/rickphobia/ai_slops.git ~/homelab/dev/ai_slops`; then `~/homelab/dev/ai_slops/projects/rss-news/deploy/update-site.sh`.
5. **Uptime Kuma:** add an HTTP(s) monitor on `https://rickphobia.com/ai-projects/rss-news/healthz`, expecting status 200, every 60 seconds.

### Update

```bash
~/homelab/dev/ai_slops/projects/rss-news/deploy/update-site.sh
```

To redeploy even though `main` hasn't changed: `RSS_NEWS_FORCE=1 ~/homelab/dev/ai_slops/projects/rss-news/deploy/update-site.sh`.

Settings are environment variables with defaults; the scripts do not read `.env`:

| Variable | Default |
|----------|---------|
| `RSS_NEWS_ENV_FILE` | `~/homelab/env/rss-news.env` |
| `RSS_NEWS_DATA_DIR` | `~/homelab/data/rss-news` |
| `RSS_NEWS_NETWORK` | `homelab_default` |
| `RSS_NEWS_SRC_DIR` | `~/homelab/dev/ai_slops` |
| `RSS_NEWS_REPO_URL` | `https://github.com/rickphobia/ai_slops.git` |
| `RSS_NEWS_BRANCH` | `main` |
| `RSS_NEWS_FORCE` | `0` |

### Roll back

```bash
~/homelab/dev/ai_slops/projects/rss-news/deploy/rollback.sh
```

Starts the previous image (recorded in `~/homelab/dev/rss-news.previous-tag`) the same way, health check and data folder included. Run it again to undo. The next `update-site.sh` run puts `main` back, so fix `main` first. Old images stay until you prune them; a pruned previous image can't be rolled back to.

### Check that it worked

```bash
curl -I https://rickphobia.com/ai-projects/rss-news/healthz   # expect HTTP 200
cat ~/homelab/dev/rss-news.deployed-tag                      # the commit that is live
docker ps --filter name=rss-news-                            # one container, healthy
```

Logs: `docker logs rss-news-<tag>-<n>`, or Dozzle.

### Try a PR before merging

`scripts/try-pr.sh <PR number>` (at the repo root) checks the PR out in its own worktree, builds the PWA and runs the backend on `localhost:8000` with a throwaway database. The Beelink preview timer (`scripts/previews.sh`) does this for every open rss-news PR and links it in the PR body. The app answers both at `/` and under `/ai-projects/rss-news/`. A preview signs in with the password `preview` (set `TRY_PR_RSS_NEWS_PASSWORD` to change it), not the real site's.

## Configuration

Settings come from environment variables, checked at startup (`src/rss_news/config.py`). A bad or missing value stops `serve` with an error naming the variable. `.env.example` lists them all with their defaults.

| Variable | Required | What it does |
|----------|----------|--------------|
| `RSS_NEWS_LOG_LEVEL` | no (`INFO`) | `DEBUG`, `INFO`, `WARNING` or `ERROR` |
| `RSS_NEWS_HOST` | no (`127.0.0.1`) | Address the web server listens on; the image sets `0.0.0.0` |
| `RSS_NEWS_PORT` | no (`8000`) | Port the web server listens on |
| `RSS_NEWS_ROOT_PATH` | no (`/ai-projects/rss-news`) | Public path prefix the app is served under |
| `RSS_NEWS_DATABASE_PATH` | no (`data/rss-news.sqlite3`) | The SQLite file; its folder is created if missing. The image uses `/app/data/rss-news.sqlite3` |
| `RSS_NEWS_PWA_DIR` | no (`pwa/dist`) | The built PWA; must contain `index.html`. The image uses `/app/pwa` |
| `RSS_NEWS_TIMEZONE` | no (`Asia/Kuala_Lumpur`) | The owner's time zone, as an IANA name |
| `RSS_NEWS_PASSWORD_HASH` | **yes** | The owner password's hash, from `rss-news hash-password` |
| `RSS_NEWS_SESSION_SECRET` | **yes** | Signs the session cookie; at least 32 characters (`openssl rand -hex 32`). Changing it signs out every device |
| `RSS_NEWS_SESSION_DAYS` | no (`60`) | How long a sign-in lasts on a device |
| `RSS_NEWS_SECURE_COOKIES` | no (`true`) | Send the cookie over https only; `false` for local runs over plain http |
| `RSS_NEWS_LOGIN_MAX_FAILURES` | no (`5`) | Wrong passwords within the lockout time that lock sign-in |
| `RSS_NEWS_LOGIN_LOCKOUT_MINUTES` | no (`15`) | How long sign-in stays locked |
| `RSS_NEWS_FETCH_INTERVAL_MINUTES` | no (`15`) | How long after a successful fetch a Source is due again |
| `RSS_NEWS_REDDIT_GAP_SECONDS` | no (`10`) | Least time between the end of one Reddit request and the start of the next |
| `RSS_NEWS_REDDIT_INTERVAL_MINUTES` | no (`60`) | How long after a successful fetch a subreddit is due again |
| `RSS_NEWS_FETCH_MAX_BACKOFF_HOURS` | no (`24`) | The longest a failing Source waits between tries |
| `RSS_NEWS_FETCH_TIMEOUT_SECONDS` | no (`20`) | How long one feed or Reader view page request may take before it counts as failed |
| `RSS_NEWS_USER_AGENT` | no (`rss-news/0.1 (+https://rickphobia.com/ai-projects/rss-news/)`) | Sent with every feed and Reader view request; Reddit refuses generic ones |
| `RSS_NEWS_ANTHROPIC_API_KEY` | **yes** | The Anthropic API key, for scoring and Briefings |
| `RSS_NEWS_ANTHROPIC_TIMEOUT_SECONDS` | no (`120`) | How long one AI request may take |
| `RSS_NEWS_ANTHROPIC_MAX_ATTEMPTS` | no (`4`) | Tries per AI call; network errors, 429 and 5xx are tried again with growing waits |
| `RSS_NEWS_SCORING_MODEL` | no (`claude-haiku-5-5`) | The model that scores new Items; it needs a price in `RSS_NEWS_MODEL_PRICES` |
| `RSS_NEWS_SCORING_BATCH_SIZE` | no (`100`) | Items per scoring call |
| `RSS_NEWS_SCORING_PROMPT_TOKEN_LIMIT` | no (`90000`) | Most estimated prompt tokens per scoring call; Haiku costs 5x more over 100K |
| `RSS_NEWS_BRIEFING_MODEL` | no (`claude-opus-5-5`) | The model that writes Briefings; it needs a price in `RSS_NEWS_MODEL_PRICES` |
| `RSS_NEWS_BRIEFING_EFFORT` | no (`low`) | How hard the Briefing model thinks: `low`, `medium` or `high` |
| `RSS_NEWS_BRIEFING_TOKEN_BUDGET` | no (`40000`) | Most estimated prompt tokens per Briefing section (one Folder) |
| `RSS_NEWS_MODEL_PRICES` | no (Haiku, Sonnet and Opus 5.5 list prices) | `model=input/output,...` in USD per million tokens, for the spending ledger |
| `RSS_NEWS_WEB_SEARCH_PRICE_USD` | no (`0.01`) | USD per web search, for the spending ledger |

## How it works

- `rss-news serve` (`src/rss_news/cli.py`) loads the settings, sets up JSON logging, creates or migrates the SQLite file, and starts uvicorn.
- `src/rss_news/wiring.py` puts the app together over its adapters: the SQLite stores, the features and the tick. `serve` and the tests both use it; the tests pass fakes for the Clock and the FeedFetcher and run the tick by hand.
- The FastAPI app (`src/rss_news/web/app.py`) answers `/healthz` with whether the database answers a query (200, or 503 when it doesn't) and `last_tick_seconds_ago`, how long ago a tick last finished with every step succeeding (`null` until the first one), and serves the built PWA for every other path under the prefix. Neither needs a session: the PWA's files hold no data, and they include the login screen.
- Sign-in follows court-booker's auth (`src/rss_news/auth/`, `src/rss_news/web/auth.py`). `POST /api/login` with `{"password": …}` checks the scrypt hash and sets a signed, HttpOnly, SameSite=Strict cookie under the prefix (204), or answers 401 (wrong password) or 429 with `minutes_left` (locked out). Every other `/api` route sits behind the `require_session` dependency and answers 401 without the cookie; add new routers to the app with that dependency. Failed attempts are kept in the `login_failures` table, so a restart doesn't reset a lockout. The cookie's signature covers the password hash, so a new password signs out every device. No CSRF tokens: a SameSite=Strict cookie isn't sent on cross-site requests, and the API only takes JSON.
- **Starter Sources** (`src/rss_news/sources/starter.py`, a copy of `docs/starter-sources.md`) are loaded once, the first time the app starts on a database. The `done_once` table remembers it, so Sources the owner later removes don't come back.
- **The tick** (`src/rss_news/tick.py`) runs in a background thread: once at start, then every minute. Its steps run in order; a failing step is logged as `tick step failed` and doesn't stop the later ones, but then the tick doesn't count for `/healthz`. Today it has two steps: fetching due Sources, then scoring new Items.
- **Fetching** (`src/rss_news/sources/fetching.py`): a Source is due when it was never fetched or its wait since the last try has passed: `RSS_NEWS_FETCH_INTERVAL_MINUTES` after a success (`RSS_NEWS_REDDIT_INTERVAL_MINUTES` for any `reddit.com` host). The FeedFetcher (`src/rss_news/adapters/feed_fetcher.py`, httpx) makes a conditional GET with the ETag and Last-Modified from last time. `feedparser` reads RSS, RDF and Atom (Reddit's too) in `sources/feed_parsing.py`. Each entry's link is cleaned of tracking parameters (`sources/clean_url.py`: `utm_*`, `fbclid`, BBC's `at_*` and others), and an Item whose clean URL is already stored is dropped, so the same story from two Sources appears once. An undated or future-dated entry counts as arriving at fetch time. One Source failing (network, HTTP status, not a feed, rate limited, or a bug) is logged with the Source and step and the next Source carries on.
- **Polite fetching** (`src/rss_news/sources/polite_queue.py`): the tick asks one host at a time, in one thread. Reddit hosts get `RSS_NEWS_REDDIT_GAP_SECONDS` between the end of one request and the start of the next; the queue asks other hosts meanwhile and sleeps only when every remaining due Source is waiting for Reddit. A 429 answer becomes `RateLimited` with its `Retry-After` (seconds or a date): every Source on that host is left due until the delay has passed, and the rate-limited Source itself waits at least that long. A failure, a 429 included, doubles the Source's wait each time in a row (15, 30, 60 minutes …) up to `RSS_NEWS_FETCH_MAX_BACKOFF_HOURS`; the first success brings back the normal interval. Sources are never disabled. The spacing, holds and failure counts live in memory, so a restart may ask a held host once more, and a broken Source starts its backoff again.
- **Scoring** (`src/rss_news/scoring/item_scoring.py`): each tick takes the unscored Items, newest first, and sends them to the scoring model in batches of up to `RSS_NEWS_SCORING_BATCH_SIZE`, keeping each call's estimated prompt under `RSS_NEWS_SCORING_PROMPT_TOKEN_LIMIT` (at most 10 calls a tick, none started after 2 minutes, so the first run's backlog takes a few minutes and fetching isn't held up). The model returns an Importance from 1 to 5 and a one-line summary in English, whatever the Item's language. The calls are ordinary Messages API calls, not the Batch API ([decision 0003](docs/decisions/0003-score-with-the-messages-api-not-the-batch-api.md)). When a call fails because of what was in it (a refusal, an answer that isn't the scores, a 400), or the answer leaves an Item out, those Items wait (1 minute, doubling to at most 6 hours) and go in batches half as big as last time, so one Item the model can't handle ends up alone. When the model is unavailable (network, outage, bad API key) the tick stops scoring and nothing is held against the Items. Unscored Items still show in the Inbox.
- **Briefings** (`src/rss_news/briefings/`, API in `web/briefings.py`, table `briefings`): Brief me covers every Item published in the last 24 hours, grouped by Folder in the Folders' order. Each Folder is one call to `RSS_NEWS_BRIEFING_MODEL`, kept under `RSS_NEWS_BRIEFING_TOKEN_BUDGET` estimated prompt tokens (`briefings/fitting.py`): every Item's one-line summary, most important first, until the budget is used, then the full text of the top 5 Items fetched through the ArticleExtractor and cut to fit (a page that can't be extracted just goes without). The model answers points with the Item ids they came from; ids it wasn't given are dropped, and the Items' titles and Sources are copied into the saved Briefing so links still read well after the Items are deleted. `GET /api/briefings/estimate` works out `estimated_cost_usd` from the Items and `RSS_NEWS_MODEL_PRICES` without calling the model, assuming every top article is as long as allowed and 2,000 output tokens per section. `POST /api/briefings` (`{"regenerate": false}`) answers a server-sent event stream: `progress` events (`step` is `reading` or `writing`, with `section`, `sections` and `folder`), then `briefing` with the saved Briefing and `reused`, or `failed` with a `detail`. When a Briefing of the same scope was written the same day in `RSS_NEWS_TIMEZONE`, it is sent back with `reused: true` and nothing is called, unless `regenerate` is true. A failed section fails the whole Briefing: nothing is saved, and the sections already written (and a refused one) stay in the spending ledger. Nothing to brief answers 422. `GET /api/briefings/latest` gives the newest one (`{"briefing": null}` before the first). Leaving the page mid-write stops the Briefing, as a failure does.
- **The LanguageModel** (`src/rss_news/adapters/language_model.py`) calls the Anthropic Messages API with structured JSON output at low effort. It retries network errors, 408, 409, 429 and 5xx itself (1, 2, 4… seconds, or the `retry-after` the API gives, at most 60), so each retry is logged; the SDK's own retries are off.
- **The spending ledger** (`src/rss_news/spending/ledger.py`, table `ai_calls`): one row per AI call with the feature, model, tokens, web searches, cost and duration. The cost comes from `RSS_NEWS_MODEL_PRICES` and is kept in millionths of a dollar so totals add up exactly. A failed call the model answered (such as a refusal) is recorded too, because it was billed.
- **The Inbox API**: `GET /api/inbox?folder=<id>&min_importance=<1-5>&sort=<newest|importance>&cursor=<next_cursor>&limit=<1-200>` lists Items with their Source, Folder, Importance and summary (both `null` until scored), 50 to a page. `sort=importance` puts the highest Importance first, newest first within one, and unscored Items last; `min_importance` leaves unscored Items out. Paging is by cursor (the last Item's position in the order), so Items arriving while you scroll don't shift the next page; a cursor only works with the order it came from. `GET /api/folders` lists the Folders for the filter.
- **Managing Sources and Folders** (`sources/managing.py`, API in `web/sources.py`): `POST/PATCH/DELETE /api/folders[/<id>]` and `GET/POST/PATCH/DELETE /api/sources[/<id>]`. `GET /api/sources` includes each Source's `paused`, `last_success_at`, `last_error_at` and `last_error`. A new feed URL (`{"folder_id", "url", "name"?}`) is fetched once and refused with 422 if it doesn't answer with a feed; a subreddit (`{"folder_id", "subreddit"}`, `r/` optional) becomes `https://www.reddit.com/r/<name>/top/.rss?t=day` without a check, since Reddit often answers a lone request with 429. Deleting a Folder that still has Sources, or adding a URL twice, answers 409; an unknown id 404. Each refusal's `detail` is shown to the owner as is. Paused Sources are skipped by the tick; removing a Source deletes its Items.
- The PWA (`pwa/`) is TypeScript built with Vite. Every backend call goes through the `ApiClient` in `pwa/src/api/client.ts`; screens get one passed in, and tests pass a fake. On any 401 the client sends the owner to the login screen. At start it asks `/api/session` and shows either login or the shell, which says whether the server is up, has a Sign out button, and starts on the home screen (`pwa/src/screens/home.ts`): the latest Briefing, each point with links that open its Items in the Item view, and Brief me with its estimated cost, progress while it is written (read from the event stream by `pwa/src/api/event-stream.ts`), and Regenerate when today's saved one comes back. The Inbox button shows the Inbox (`pwa/src/screens/inbox.ts`): Items linking to the original page, each with its Importance (a dash until scored) and one-line summary, filters for Folder and Importance, a Newest / Most important sort, and a Load more button. Unread Items carry a dot (labelled Unread); a title opens the Item view (`pwa/src/screens/item.ts`). The Sources button opens `pwa/src/screens/sources.ts`.
- **The Item view and Reader view** (`items/reading.py`, API in `web/items.py`): `GET /api/items/<id>` returns the Item as the Inbox lists it and marks it read (`read_at`, the first open's time; the Inbox's `read` field). The PWA shows the summary, Source, time and Importance with an Open the original page link at once, then asks `GET /api/items/<id>/reader` straight away and shows Loading the article… until it answers. The ArticleExtractor (`adapters/article_extractor.py`) fetches the page with `RSS_NEWS_USER_AGENT` and `RSS_NEWS_FETCH_TIMEOUT_SECONDS`, refuses bodies over 10 MB, and keeps only the article text (trafilatura). Nothing is stored: each open fetches again. When it fails the API answers 502 with a `detail` such as `Reader view isn't available: the page answered HTTP 403.`, which the PWA shows with the original link again.

## Folder layout

```
src/rss_news/
  config.py          settings from the environment, validated at startup
  json_logging.py    JSON-lines logs on stdout
  clock.py           the current time, faked in tests
  cli.py             the entrypoint: `rss-news serve` and `rss-news hash-password`
  wiring.py          puts the stores, features and tick together over the adapters
  tick.py            the steps run every minute, and the background loop running them
  auth/              password hashes, signed session cookies, lockout
  sources/           Folders and Sources, the starter set, the owner's changes, fetching due Sources,
                     the polite fetch queue (host spacing, retry delays, backoff),
                     feed parsing and tracking-parameter cleaning
  items/             Items and the Inbox query with its orders, filters and paging cursor;
                     opening one Item (read state, Reader view)
  scoring/           giving new Items an Importance and a summary, in batches, with retries
  briefings/         choosing the Items, fitting each Folder into the token budget, the estimate,
                     writing a section per Folder, and reusing today's Briefing
  spending/          the ledger of AI calls and what they cost
  web/app.py         the FastAPI app: /healthz, the API routers and the PWA
  web/auth.py        login, logout, the session check and the guard on /api
  web/inbox.py       GET /api/inbox
  web/sources.py     /api/folders and /api/sources
  web/briefings.py   /api/briefings: latest, estimate, and writing one as server-sent events
  adapters/feed_fetcher.py  the FeedFetcher over HTTP (httpx)
  adapters/article_extractor.py  the ArticleExtractor: fetches a page (httpx), cleans it (trafilatura)
  adapters/language_model.py  the LanguageModel over the Anthropic Messages API
  adapters/sqlite/   the database file, its migrations, login failures, Sources, Items, spending,
                     Briefings
tests/               mirrors src/rss_news/; tests/sources/feeds/ holds saved real feeds,
                     tests/adapters/anthropic/ saved scoring and Briefing-section answers
pwa/
  src/api/client.ts  the one module that talks to the backend
  src/screens/       one module per screen
  tests/             Vitest + Testing Library, against a fake ApiClient
scripts/docker-smoke-test.sh
deploy/              update-site.sh, rollback.sh and their shared settings.sh
docs/                spec, tickets, decisions
```

## Debugging

- Logs are JSON lines on stdout, one object per event with `time`, `level`, `logger`, `message` and any extra fields. Set `RSS_NEWS_LOG_LEVEL=DEBUG` for more. In Docker: `docker logs <container>`.
- `serve` exits with code 2 and an `invalid configuration` log line naming the variable when a setting is bad, and with `database unusable` when the SQLite file or its folder can't be opened or written (often a volume owned by another user).
- Each feed request logs `feed request` with the host, result and `duration_ms`; each Source then logs `source fetched` (with `entries` and `new_items`), `source not modified` (debug) or `source fetch failed` (warning) with `source`, `step` (`connect`, `timeout`, `http status`, `parse`, `rate limited`, …), `detail`, `failures_in_a_row` and `next_try_in_minutes`. A `Retry-After` logs `host on hold` with `retry_after_seconds`; Sources skipped for it log `source left for a later tick: host on hold` at debug. A Source's last error is also kept in the `sources` table: `sqlite3 data/rss-news.sqlite3 'SELECT name, last_error_at, last_error FROM sources WHERE last_error IS NOT NULL'`. If Reddit still answers 429 often, raise `RSS_NEWS_REDDIT_GAP_SECONDS` and check `RSS_NEWS_USER_AGENT` is specific.
- Reader view: each page logs `article extraction` with the `host`, `result` (`ok` or the reason shown to the owner) and `duration_ms`. Many failures for one host usually mean it blocks bots or needs JavaScript; the owner still gets the original link.
- Scoring: each AI call logs `ai call` with `feature`, `model`, tokens, `cost_usd` and `duration_ms`; `ai call retried` (warning) names the attempt, wait and error; `ai call failed` (error) has the HTTP status and Anthropic request id. `scoring failed` (warning) lists the `item_ids` of a failed batch, which are retried later; `scoring paused until the next tick: the model is unavailable` (error) every minute usually means a wrong `RSS_NEWS_ANTHROPIC_API_KEY` (HTTP 401) or no credit. Items still waiting: `sqlite3 data/rss-news.sqlite3 'SELECT id, title, score_failures, score_retry_at FROM items WHERE scored_at IS NULL ORDER BY score_failures DESC LIMIT 20'`. This month's spend: `sqlite3 data/rss-news.sqlite3 "SELECT feature, count(*), sum(cost_micro_usd) / 1e6 FROM ai_calls WHERE called_at >= strftime('%Y-%m-01') GROUP BY feature"`.
- Briefings: `briefing started` (with `items` and `sections`), one `ai call` with `feature` `briefings` per section, then `briefing written` with its `briefing_id` and `cost_usd`, or `briefing failed` (error) naming the `folder` and the `detail`. `briefing section cut to fit` says how many of a Folder's Items made the budget; `briefing article unavailable` (warning) names an Item whose full text couldn't be fetched. `briefing reused` means today's was given back for free. Saved ones: `sqlite3 data/rss-news.sqlite3 'SELECT id, scope, created_at, item_count, cost_micro_usd / 1e6 FROM briefings ORDER BY id DESC LIMIT 5'`. If progress never shows on the phone but the Briefing arrives at the end, a proxy is buffering the stream; the API sends `X-Accel-Buffering: no` for nginx.
- `last_tick_seconds_ago` in `/healthz` keeps growing: look for `tick step failed` in the logs (a whole step broke) or for no `tick loop started` line at all.
- `RSS_NEWS_PWA_DIR ... index.html is missing`: the PWA isn't built. Run `npm run build` in `pwa/`.
- The page loads but says "Can't reach the server": `/healthz` didn't answer with a health report; check the backend is running and the prefix matches.
- Signing in works but the next screen goes straight back to login: the browser dropped the cookie. Over plain http set `RSS_NEWS_SECURE_COOKIES=false`.
- Sign-ins log `owner signed in` (info), `sign-in failed: wrong password` and `sign-in refused: locked out…` (warning) with the client address; never the password. To lift a lockout early, delete the rows: `sqlite3 data/rss-news.sqlite3 'DELETE FROM login_failures'`.

## Decisions

See [`docs/decisions/`](docs/decisions/) for why things are the way they are.
