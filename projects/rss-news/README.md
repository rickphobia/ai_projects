# rss-news

A personal news briefing for one owner: it reads many Sources (RSS and Atom feeds, subreddits, newsletters, ticker news) and writes a short Briefing on request, so the owner only opens an Item when something catches their interest. To be served at `rickphobia.com/ai-projects/rss-news/`. What it will do is in [`docs/spec.md`](docs/spec.md); the words it uses are in [`GLOSSARY.md`](GLOSSARY.md).

## Status

`in progress`: walking skeleton. The backend answers `/healthz` and serves an empty PWA under the path prefix, locally and in Docker. No feeds, sign-in or AI yet; those are the tickets in [`docs/tickets/`](docs/tickets/).

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

CI (`.github/workflows/rss-news.yml`) runs the same commands, `shellcheck` on `scripts/`, and the Docker smoke test below.

## Docker

```bash
docker build --tag rss-news .
docker run --rm --publish 127.0.0.1:8000:8000 --volume "$PWD/data:/app/data" rss-news
scripts/docker-smoke-test.sh   # builds, starts with dummy settings, checks /healthz, the PWA and memory use
```

The image is built in two stages ([decision 0002](docs/decisions/0002-python-api-with-typescript-pwa.md)): a Node stage builds the PWA, and the Python stage runs `rss-news serve` and serves the built files from `/app/pwa`. The database lives in `/app/data`; mount a volume there so it survives new containers. The image runs as an unprivileged user and has a Docker `HEALTHCHECK` on `/healthz`.

The smoke test fails if `/healthz`, the page or its script don't answer under the prefix, if the database isn't written to the mounted folder, or if the container uses 300MB of RAM or more (the spec's budget). Deploying to the Beelink is ticket 02.

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
docs/                spec, tickets, decisions
```

## Debugging

- Logs are JSON lines on stdout, one object per event with `time`, `level`, `logger`, `message` and any extra fields. Set `RSS_NEWS_LOG_LEVEL=DEBUG` for more. In Docker: `docker logs <container>`.
- `serve` exits with code 2 and an `invalid configuration` log line naming the variable when a setting is bad, and with `database unusable` when the SQLite file or its folder can't be opened or written (often a volume owned by another user).
- `RSS_NEWS_PWA_DIR ... index.html is missing`: the PWA isn't built. Run `npm run build` in `pwa/`.
- The page loads but says "Can't reach the server": `/healthz` didn't answer with a health report; check the backend is running and the prefix matches.

## Decisions

See [`docs/decisions/`](docs/decisions/) for why things are the way they are.
