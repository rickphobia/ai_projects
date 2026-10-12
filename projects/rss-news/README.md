# rss-news

A personal news briefing for one owner: it reads many Sources (RSS and Atom feeds, subreddits, newsletters, ticker news) and writes a short Briefing on request, so the owner only opens an Item when something catches their interest. To be served at `rickphobia.com/ai-projects/rss-news/`. What it will do is in [`docs/spec.md`](docs/spec.md); the words it uses are in [`GLOSSARY.md`](GLOSSARY.md).

## Status

`in progress`: walking skeleton. The backend answers `/healthz` and serves an empty PWA under the path prefix, locally and in Docker. Deployable to the Beelink. No feeds, sign-in or AI yet; those are the tickets in [`docs/tickets/`](docs/tickets/).

## Requirements

- [uv](https://docs.astral.sh/uv/) 0.9 or later. It installs the pinned Python (3.13, see `.python-version`) by itself.
- Node.js 24.18 (see `pwa/.nvmrc`; `nvm use` picks it up) and npm, for the PWA.
- Docker, for the image the server runs.
- No accounts or API keys yet.

## Setup

```bash
cd projects/rss-news
uv sync                          # creates .venv with the locked Python dependencies
(cd pwa && npm ci && npm run build)   # installs the PWA's locked dependencies and builds it into pwa/dist
cp .env.example .env             # every value is a working default for local runs
```

## Run

```bash
uv run --env-file .env rss-news serve
curl http://127.0.0.1:8000/ai-projects/rss-news/healthz   # {"status":"ok","database":"ok"}
```

Then open <http://127.0.0.1:8000/ai-projects/rss-news/>. The backend serves whatever is in `pwa/dist`, so run `npm run build` in `pwa/` again after changing the PWA.

While working on the PWA, run the backend as above and `npm run dev` in `pwa/` alongside it: Vite serves the PWA with live reload at <http://127.0.0.1:5173/> and forwards `/healthz` to the backend.

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
docker run --rm --publish 127.0.0.1:8000:8000 --volume "$PWD/data:/app/data" rss-news
scripts/docker-smoke-test.sh   # builds, starts with dummy settings, checks /healthz, the PWA and memory use
```

The image is built in two stages ([decision 0002](docs/decisions/0002-python-api-with-typescript-pwa.md)): a Node stage builds the PWA, and the Python stage runs `rss-news serve` and serves the built files from `/app/pwa`. The database lives in `/app/data`; mount a volume there so it survives new containers. The image runs as an unprivileged user and has a Docker `HEALTHCHECK` on `/healthz`.

The smoke test fails if `/healthz`, the page or its script don't answer under the prefix, if the database isn't written to the mounted folder, or if the container uses 300MB of RAM or more (the spec's budget).

## Deploy

The app runs as a Docker container on the Beelink, on the shared `homelab_default` network, behind the host nginx (`portfolio-nginx`) at `https://rickphobia.com/ai-projects/rss-news/`. GitHub can't reach the home network, so the server pulls: you run one script there. The scripts are the same as court-booker's.

`deploy/update-site.sh` fetches `main` into `~/homelab/dev/ai_slops`, builds the image `rss-news:<commit>`, loads `deploy/settings.sh` again from that commit, starts a new container with the env file and the data folder mounted at `/app/data` (where the SQLite file lives), and waits up to 60 seconds for `/healthz`. Only then does it give the new container the network name `rss-news` (which nginx proxies to) and remove the old one. If any step fails, the script exits non-zero, names the step, and the old container keeps serving. If `main` hasn't moved and its container is running, it does nothing. The settings both scripts share are in `deploy/settings.sh`.

### One-time setup (on the Beelink)

Needs `git`, `docker` (your user can run it without sudo) and `flock` (already on Ubuntu).

1. **Env file** (the secrets file), outside the repo: `mkdir -p ~/homelab/env && cp projects/rss-news/.env.example ~/homelab/env/rss-news.env && chmod 600 ~/homelab/env/rss-news.env`. The deploy forces `RSS_NEWS_HOST`, `RSS_NEWS_DATABASE_PATH` and `RSS_NEWS_PWA_DIR` to the container's values, so leave the rest as is. Later tickets add secrets (sign-in, AI and push keys) to the Configuration table below; put them in this file and never commit them.
2. **Data folder** (the SQLite file, kept across deploys and rollbacks): `mkdir -p ~/homelab/data/rss-news`. The container runs as your user, so it can write there.
3. **nginx.** Save this as `~/homelab/nginx/projects/rss-news.conf` (included inside the existing server block), then check and reload: `docker exec portfolio-nginx nginx -t && docker exec portfolio-nginx nginx -s reload`.

   ```nginx
   # rss-news: proxied to the container on homelab_default.
   location = /ai-projects/rss-news { return 301 https://$host$uri/; }

   location /ai-projects/rss-news/ {
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

`scripts/try-pr.sh <PR number>` (at the repo root) checks the PR out in its own worktree, builds the PWA and runs the backend on `localhost:8000` with a throwaway database. The Beelink preview timer (`scripts/previews.sh`) does this for every open rss-news PR and links it in the PR body. The app answers both at `/` and under `/ai-projects/rss-news/`.

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

## How it works

- `rss-news serve` (`src/rss_news/cli.py`) loads the settings, sets up JSON logging, creates or migrates the SQLite file, and starts uvicorn.
- The FastAPI app (`src/rss_news/web/app.py`) answers `/healthz` with whether the database answers a query (200, or 503 when it doesn't) and serves the built PWA for every other path under the prefix. It needs no login.
- The PWA (`pwa/`) is TypeScript built with Vite. Every backend call goes through the `ApiClient` in `pwa/src/api/client.ts`; screens get one passed in, and tests pass a fake. For now its only screen shows whether the server is up.

## Folder layout

```
src/rss_news/
  config.py          settings from the environment, validated at startup
  json_logging.py    JSON-lines logs on stdout
  cli.py             the entrypoint: `rss-news serve`
  web/app.py         the FastAPI app: /healthz and the PWA
  adapters/sqlite/   the database file and its migrations
tests/               mirrors src/rss_news/
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
- `RSS_NEWS_PWA_DIR ... index.html is missing`: the PWA isn't built. Run `npm run build` in `pwa/`.
- The page loads but says "Can't reach the server": `/healthz` didn't answer with a health report; check the backend is running and the prefix matches.

## Decisions

See [`docs/decisions/`](docs/decisions/) for why things are the way they are.
