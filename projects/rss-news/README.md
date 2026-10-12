# rss-news

A personal news briefing for one owner: it reads many Sources (RSS and Atom feeds, subreddits, newsletters, ticker news) and writes a short Briefing on request, so the owner only opens an Item when something catches their interest. To be served at `rickphobia.com/ai-projects/rss-news/`. What it will do is in [`docs/spec.md`](docs/spec.md); the words it uses are in [`GLOSSARY.md`](GLOSSARY.md).

## Status

`in progress`: feeds arrive in the Inbox. On first run the starter Sources from [`docs/starter-sources.md`](docs/starter-sources.md) are loaded; every minute the server fetches the Sources that are due and stores new Items once each. The owner signs in with one password and sees the Inbox, newest first, with a Folder filter, and manages Sources and Folders: add a feed URL or a subreddit, create, rename and delete Folders, move, pause or remove a Source, and see each Source's last success and last error. It installs to the home screen from Chrome, and its service worker caches the app shell (never API answers). Deployable to the Beelink. Fetching is polite: Reddit requests are spaced out, retry delays are honoured and failing Sources back off. No AI yet; that's the tickets in [`docs/tickets/`](docs/tickets/).

## Requirements

- [uv](https://docs.astral.sh/uv/) 0.9 or later. It installs the pinned Python (3.13, see `.python-version`) by itself.
- Node.js 24.18 (see `pwa/.nvmrc`; `nvm use` picks it up) and npm, for the PWA.
- Docker, for the image the server runs.
- No accounts or API keys yet; you pick the sign-in password at setup.

## Setup

```bash
cd projects/rss-news
uv sync                          # creates .venv with the locked Python dependencies
(cd pwa && npm ci && npm run build)   # installs the PWA's locked dependencies and builds it into pwa/dist
cp .env.example .env
uv run rss-news hash-password    # asks for the password twice; paste the output into RSS_NEWS_PASSWORD_HASH
openssl rand -hex 32             # paste into RSS_NEWS_SESSION_SECRET
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

1. **Env file** (the secrets file), outside the repo: `mkdir -p ~/homelab/env && cp projects/rss-news/.env.example ~/homelab/env/rss-news.env && chmod 600 ~/homelab/env/rss-news.env`. The deploy forces `RSS_NEWS_HOST`, `RSS_NEWS_DATABASE_PATH` and `RSS_NEWS_PWA_DIR` to the container's values, so leave the rest as is, except the two sign-in secrets: set `RSS_NEWS_PASSWORD_HASH` to the output of `docker run --rm -it rss-news:<commit> rss-news hash-password` (or `uv run rss-news hash-password` in a checkout) and `RSS_NEWS_SESSION_SECRET` to `openssl rand -hex 32`. Without them the container won't start. Later tickets add more secrets (AI and push keys) to the Configuration table below; put them in this file and never commit them.
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
| `RSS_NEWS_FETCH_TIMEOUT_SECONDS` | no (`20`) | How long one feed request may take before it counts as failed |
| `RSS_NEWS_USER_AGENT` | no (`rss-news/0.1 (+https://rickphobia.com/ai-projects/rss-news/)`) | Sent with every feed request; Reddit refuses generic ones |

## How it works

- `rss-news serve` (`src/rss_news/cli.py`) loads the settings, sets up JSON logging, creates or migrates the SQLite file, and starts uvicorn.
- `src/rss_news/wiring.py` puts the app together over its adapters: the SQLite stores, the features and the tick. `serve` and the tests both use it; the tests pass fakes for the Clock and the FeedFetcher and run the tick by hand.
- The FastAPI app (`src/rss_news/web/app.py`) answers `/healthz` with whether the database answers a query (200, or 503 when it doesn't) and `last_tick_seconds_ago`, how long ago a tick last finished with every step succeeding (`null` until the first one), and serves the built PWA for every other path under the prefix. Neither needs a session: the PWA's files hold no data, and they include the login screen.
- Sign-in follows court-booker's auth (`src/rss_news/auth/`, `src/rss_news/web/auth.py`). `POST /api/login` with `{"password": …}` checks the scrypt hash and sets a signed, HttpOnly, SameSite=Strict cookie under the prefix (204), or answers 401 (wrong password) or 429 with `minutes_left` (locked out). Every other `/api` route sits behind the `require_session` dependency and answers 401 without the cookie; add new routers to the app with that dependency. Failed attempts are kept in the `login_failures` table, so a restart doesn't reset a lockout. The cookie's signature covers the password hash, so a new password signs out every device. No CSRF tokens: a SameSite=Strict cookie isn't sent on cross-site requests, and the API only takes JSON.
- **Starter Sources** (`src/rss_news/sources/starter.py`, a copy of `docs/starter-sources.md`) are loaded once, the first time the app starts on a database. The `done_once` table remembers it, so Sources the owner later removes don't come back.
- **The tick** (`src/rss_news/tick.py`) runs in a background thread: once at start, then every minute. Its steps run in order; a failing step is logged as `tick step failed` and doesn't stop the later ones, but then the tick doesn't count for `/healthz`. Today it has one step, fetching due Sources.
- **Fetching** (`src/rss_news/sources/fetching.py`): a Source is due when it was never fetched or its wait since the last try has passed: `RSS_NEWS_FETCH_INTERVAL_MINUTES` after a success (`RSS_NEWS_REDDIT_INTERVAL_MINUTES` for any `reddit.com` host). The FeedFetcher (`src/rss_news/adapters/feed_fetcher.py`, httpx) makes a conditional GET with the ETag and Last-Modified from last time. `feedparser` reads RSS, RDF and Atom (Reddit's too) in `sources/feed_parsing.py`. Each entry's link is cleaned of tracking parameters (`sources/clean_url.py`: `utm_*`, `fbclid`, BBC's `at_*` and others), and an Item whose clean URL is already stored is dropped, so the same story from two Sources appears once. An undated or future-dated entry counts as arriving at fetch time. One Source failing (network, HTTP status, not a feed, rate limited, or a bug) is logged with the Source and step and the next Source carries on.
- **Polite fetching** (`src/rss_news/sources/polite_queue.py`): the tick asks one host at a time, in one thread. Reddit hosts get `RSS_NEWS_REDDIT_GAP_SECONDS` between the end of one request and the start of the next; the queue asks other hosts meanwhile and sleeps only when every remaining due Source is waiting for Reddit. A 429 answer becomes `RateLimited` with its `Retry-After` (seconds or a date): every Source on that host is left due until the delay has passed, and the rate-limited Source itself waits at least that long. A failure, a 429 included, doubles the Source's wait each time in a row (15, 30, 60 minutes …) up to `RSS_NEWS_FETCH_MAX_BACKOFF_HOURS`; the first success brings back the normal interval. Sources are never disabled. The spacing, holds and failure counts live in memory, so a restart may ask a held host once more, and a broken Source starts its backoff again.
- **The Inbox API**: `GET /api/inbox?folder=<id>&cursor=<next_cursor>&limit=<1-200>` lists Items newest first with their Source and Folder, 50 to a page. Paging is by cursor (the last Item's time and id), so Items arriving while you scroll don't shift the next page. `GET /api/folders` lists the Folders for the filter.
- **Managing Sources and Folders** (`sources/managing.py`, API in `web/sources.py`): `POST/PATCH/DELETE /api/folders[/<id>]` and `GET/POST/PATCH/DELETE /api/sources[/<id>]`. `GET /api/sources` includes each Source's `paused`, `last_success_at`, `last_error_at` and `last_error`. A new feed URL (`{"folder_id", "url", "name"?}`) is fetched once and refused with 422 if it doesn't answer with a feed; a subreddit (`{"folder_id", "subreddit"}`, `r/` optional) becomes `https://www.reddit.com/r/<name>/top/.rss?t=day` without a check, since Reddit often answers a lone request with 429. Deleting a Folder that still has Sources, or adding a URL twice, answers 409; an unknown id 404. Each refusal's `detail` is shown to the owner as is. Paused Sources are skipped by the tick; removing a Source deletes its Items.
- The PWA (`pwa/`) is TypeScript built with Vite. Every backend call goes through the `ApiClient` in `pwa/src/api/client.ts`; screens get one passed in, and tests pass a fake. On any 401 the client sends the owner to the login screen. At start it asks `/api/session` and shows either login or the shell, which says whether the server is up, has a Sign out button, and shows the Inbox (`pwa/src/screens/inbox.ts`): Items newest first linking to the original page, a Folder filter and a Load more button. The Sources button opens `pwa/src/screens/sources.ts`.

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
  items/             Items and the Inbox query with its paging cursor
  web/app.py         the FastAPI app: /healthz, the API routers and the PWA
  web/auth.py        login, logout, the session check and the guard on /api
  web/inbox.py       GET /api/inbox
  web/sources.py     /api/folders and /api/sources
  adapters/feed_fetcher.py  the FeedFetcher over HTTP (httpx)
  adapters/sqlite/   the database file, its migrations, login failures, Sources, Items
tests/               mirrors src/rss_news/; tests/sources/feeds/ holds saved real feeds
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
- `last_tick_seconds_ago` in `/healthz` keeps growing: look for `tick step failed` in the logs (a whole step broke) or for no `tick loop started` line at all.
- `RSS_NEWS_PWA_DIR ... index.html is missing`: the PWA isn't built. Run `npm run build` in `pwa/`.
- The page loads but says "Can't reach the server": `/healthz` didn't answer with a health report; check the backend is running and the prefix matches.
- Signing in works but the next screen goes straight back to login: the browser dropped the cookie. Over plain http set `RSS_NEWS_SECURE_COOKIES=false`.
- Sign-ins log `owner signed in` (info), `sign-in failed: wrong password` and `sign-in refused: locked out…` (warning) with the client address; never the password. To lift a lockout early, delete the rows: `sqlite3 data/rss-news.sqlite3 'DELETE FROM login_failures'`.

## Decisions

See [`docs/decisions/`](docs/decisions/) for why things are the way they are.
