# court-booker

Books the badminton Court at 1120 Park Avenue on Picktime the moment a date opens, so nobody has to stay up past midnight to do it. Built for one Operator; served at `rickphobia.com/ai-projects/court-booker/`.

## Status

`in progress`: walking skeleton, Operator login, the encrypted Profile, Booking Requests, the Picktime browser adapter with `dry-run`, and booking at Release Time. The Operator saves the Profile and creates Booking Requests; a background scheduler books each one's Slots on Picktime at its run time, and the list shows each Slot as Booked, Taken or Failed. It recovers after downtime, deletes old data after 30 days, shows each attempt's screenshot, and tries a date again if Picktime hasn't opened it in the first minute after Release Time.

## Requirements

- [uv](https://docs.astral.sh/uv/) 0.9 or later. It installs the pinned Python (3.12, see `.python-version`) by itself.
- Docker, for the image the server runs.
- Headless Chromium for the browser tests and `dry-run`: `uv run playwright install --with-deps --only-shell chromium` once (the Docker image already has it).
- No accounts or API keys yet; the only secrets are the two you make in Setup.

## Setup

```bash
cd projects/court-booker
uv sync                  # creates .venv with the locked dependencies
uv run playwright install --with-deps --only-shell chromium   # the browser Playwright drives
cp .env.example .env     # then fill in the three secrets:
uv run court-booker hash-password   # asks for the Operator password twice, prints its hash
openssl rand -hex 32                # a session secret
openssl rand -base64 32 | tr '+/' '-_'   # a Profile key
```

Put the hash in `COURT_BOOKER_OPERATOR_PASSWORD_HASH`, the secret in `COURT_BOOKER_SESSION_SECRET` and the key in `COURT_BOOKER_PROFILE_KEY`. None belongs in the repo; on the server they live in the env file outside it. `hash-password` also reads the password from a pipe (first line), for scripts.

## Run

```bash
uv run --env-file .env court-booker serve
curl http://127.0.0.1:8000/ai-projects/court-booker/healthz   # {"status":"ok","database":"ok","last_tick_seconds_ago":2}
```

Then open <http://127.0.0.1:8000/ai-projects/court-booker/> and log in. **`serve` books for real:** a Booking Request that comes due while it runs is booked on the live Picktime page with the saved Profile. Locally, cancel your test requests before their run time. Use the prefixed URL: cookies are scoped to the prefix, so logging in without it (`/login`) won't stick, though the routes answer there. Locally `.env.example` sets `COURT_BOOKER_SECURE_COOKIES=false`, because the browser won't send a Secure cookie over plain http.

## Test

```bash
uv run ruff check && uv run ruff format --check && uv run mypy && uv run pytest
```

The browser adapter's tests (`tests/adapters/picktime_browser/`) drive real headless Chromium against a local copy of the booking page (`booking_page.html`), never the live site; they take about 30 seconds.

CI (`.github/workflows/court-booker.yml`) installs Chromium, runs the same commands, `shellcheck` on `scripts/` and `deploy/`, and the Docker smoke test below.

## Dry run (touches the live Picktime page)

```bash
uv run --env-file .env court-booker dry-run --date 2026-10-08 --slot 20:00
```

It reads the stored Profile, opens the **real** Picktime page in headless Chromium, picks the Court, the date and the Slot, fills in the form and stops before clicking Book. It makes a trial click on Book, which checks the button could be clicked and clicks nothing. It prints the outcome (`ReadyToBook()` when everything worked; `Taken()`, `NotOpen()` or `NetworkError(step=..., detail=...)` otherwise) and the screenshot's path. The exit code is 0 only for `ReadyToBook`.

**It loads the live page, so use it sparingly:** before the first real booking and after any Picktime change. It never submits, so it books nothing. Use a date that's open (today up to the Booking Window) and a free Slot. The screenshot shows the Profile, so don't share it. On the server, run it inside the running container: `docker exec court-booker-<tag>-<n> court-booker dry-run --date ... --slot ...`.

## Docker

The image is based on the pinned Playwright Python image, so Chromium comes with it (decision 0001).

```bash
scripts/docker-smoke-test.sh     # build, start with throwaway secrets, check /healthz and /login, remove

docker build -t court-booker .
docker run --rm -p 127.0.0.1:8000:8000 --env-file .env -e COURT_BOOKER_HOST=0.0.0.0 court-booker
```

The `-e COURT_BOOKER_HOST=0.0.0.0` overrides the `127.0.0.1` from `.env`, which would make the container unreachable. The image has a Docker `HEALTHCHECK` on `/healthz`; `docker ps` shows `healthy` once it answers.

## Configuration

Every setting is an environment variable, read and validated once at startup by `src/court_booker/config.py`. A bad value stops the app with an error naming the variable.

| Variable | Required | Default | What it does |
|----------|----------|---------|--------------|
| `COURT_BOOKER_LOG_LEVEL` | no | `INFO` | `DEBUG`, `INFO`, `WARNING` or `ERROR` |
| `COURT_BOOKER_HOST` | no | `127.0.0.1` (`0.0.0.0` in the image) | Address the web server listens on |
| `COURT_BOOKER_PORT` | no | `8000` | Port the web server listens on |
| `COURT_BOOKER_ROOT_PATH` | no | `/ai-projects/court-booker` | Public path prefix the host nginx serves the app under |
| `COURT_BOOKER_OPERATOR_PASSWORD_HASH` | **yes** | | The Operator password as an scrypt hash from `court-booker hash-password` |
| `COURT_BOOKER_SESSION_SECRET` | **yes** | | At least 32 characters; signs session cookies and CSRF tokens. Changing it logs the Operator out |
| `COURT_BOOKER_PROFILE_KEY` | **yes** | | Fernet key (32 random bytes, url-safe base64) that encrypts the Profile. Losing or changing it means re-entering the Profile |
| `COURT_BOOKER_DATABASE_PATH` | no | `data/court-booker.sqlite3` (`/app/data/court-booker.sqlite3` in the image) | The SQLite file; its folder is created if missing |
| `COURT_BOOKER_SESSION_DAYS` | no | `30` | How long a login lasts |
| `COURT_BOOKER_SECURE_COOKIES` | no | `true` | Send cookies over https only. Set `false` only for local http |
| `COURT_BOOKER_LOGIN_MAX_FAILURES` | no | `5` | Wrong passwords that trigger the lockout |
| `COURT_BOOKER_LOGIN_LOCKOUT_MINUTES` | no | `15` | The window failures are counted in, and how long the lock lasts; see "How it works" |
| `COURT_BOOKER_VENUE_TIMEZONE` | no | `Asia/Kuala_Lumpur` | IANA timezone of the venue: Release Times are midnight here, run times are shown in it, and the browser runs in it (the page shows Slot times in local time) |
| `COURT_BOOKER_SLOTS` | no | `08:00,10:00,12:00,14:00,16:00,18:00,20:00` | The Court's Slots, as comma-separated `HH:MM` start times; the only ones the Operator can tick |
| `COURT_BOOKER_BOOKING_WINDOW_DAYS` | no | `2` | How many days ahead Picktime opens a date. A date's Release Time is venue midnight this many days before it |
| `COURT_BOOKER_RUN_JITTER_MIN_SECONDS` | no | `60` | A Booking Request runs a random moment between the min and max seconds after Release Time |
| `COURT_BOOKER_RUN_JITTER_MAX_SECONDS` | no | `120` | Must not be less than the min |
| `COURT_BOOKER_OPEN_DATE_DELAY_SECONDS` | no | `60` | A request for a date already open (past its Release Time) runs this long after it is created |
| `COURT_BOOKER_PICKTIME_URL` | no | the 1120 Park Avenue booking page | The public Picktime booking page (http or https) |
| `COURT_BOOKER_COURT_NAME` | no | `Badminton Hall 1` | The Court as that page lists it (matched as part of the entry's text) |
| `COURT_BOOKER_PICKTIME_TIMEOUT_SECONDS` | no | `30` | How long one step on the page may take before the attempt is a network error |
| `COURT_BOOKER_SCREENSHOT_DIR` | no | `data/screenshots` (`/app/data/screenshots` in the image) | Where each attempt's screenshot is saved; created if missing |
| `COURT_BOOKER_RETENTION_DAYS` | no | `30` | Booking Requests, Slot results and screenshots are deleted this many days after their date |
| `COURT_BOOKER_SLOT_PAUSE_MIN_SECONDS` | no | `5` | A run waits a random time between the min and max seconds between two Slots |
| `COURT_BOOKER_SLOT_PAUSE_MAX_SECONDS` | no | `20` | Must not be less than the min |
| `COURT_BOOKER_RETRY_COUNT` | no | `2` | How many times a Slot attempt that hit a network error is retried |
| `COURT_BOOKER_RETRY_BACKOFF_SECONDS` | no | `10` | The wait before the first retry; each later wait doubles it. Also the wait between tries of a date not open yet |
| `COURT_BOOKER_NOT_OPEN_GRACE_SECONDS` | no | `60` | A date found not open this soon after its Release Time is tried again; no try starts later than this. `0` fails it at once |
| `COURT_BOOKER_SCHEDULER_TICK_SECONDS` | no | `5` | How often the scheduler looks for due Booking Requests; a run starts at most this late |
| `COURT_BOOKER_SCHEDULER_STALE_SECONDS` | no | `600` | `/healthz` fails when the scheduler hasn't ticked or made progress for this long. Must be more than the tick |

## Deploy

The app runs as a Docker container on the Beelink, on the shared `homelab_default` network, behind the host nginx (`portfolio-nginx`) at `https://rickphobia.com/ai-projects/court-booker/`. GitHub can't reach the home network, so the server pulls: you run one script there.

`deploy/update-site.sh` fetches `main` into `~/homelab/dev/ai_projects`, builds the image `court-booker:<commit>`, loads `deploy/settings.sh` again from that commit, starts a new container with the env file and the data folder mounted at `/app/data` (where the image keeps the database and screenshots), and waits up to 60 seconds for `/healthz`. Only then does it give the new container the network name `court-booker` (which nginx proxies to) and remove the old one. If any step fails, the script exits non-zero, names the step, and the old container keeps serving. If `main` hasn't moved and its container is running, it does nothing.

### One-time setup (on the Beelink)

Needs `git`, `docker` (your user can run it without sudo) and `flock` (already on Ubuntu).

1. **Env file**, outside the repo: `mkdir -p ~/homelab/env && cp projects/court-booker/.env.example ~/homelab/env/court-booker.env && chmod 600 ~/homelab/env/court-booker.env`. The deploy forces `COURT_BOOKER_HOST=0.0.0.0`, so leave the rest as is. Once Operator login (ticket 02) and the encrypted Profile (ticket 03) are merged, this file also holds the Operator's password hash and the Profile encryption key; those tickets add them to the Configuration table above with the command that generates each. Generate them on the server and never commit them.
2. **Data folder** (database and screenshots, kept across deploys): `mkdir -p ~/homelab/data/court-booker`. The container runs as your user, so it can write there.
3. **nginx.** Save this as `~/homelab/nginx/projects/court-booker.conf` (included inside the existing server block), then check and reload: `docker exec portfolio-nginx nginx -t && docker exec portfolio-nginx nginx -s reload`.

   ```nginx
   # court-booker: proxied to the container on homelab_default.
   location = /ai-projects/court-booker { return 301 https://$host$uri/; }

   location /ai-projects/court-booker/ {
       # Resolve per request, so a missing container is a 502 here, not an nginx that won't start.
       resolver 127.0.0.11 valid=10s;
       set $court_booker_upstream court-booker:8000;
       # No URI part: the app gets the full /ai-projects/court-booker/... path and handles the prefix.
       proxy_pass http://$court_booker_upstream;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto https;
   }
   ```

4. **First deploy:** `mkdir -p ~/homelab/dev && git clone https://github.com/rickphobia/ai_projects.git ~/homelab/dev/ai_projects`, then `~/homelab/dev/ai_projects/projects/court-booker/deploy/update-site.sh`.
5. **Uptime Kuma:** add an HTTP(s) monitor on `https://rickphobia.com/ai-projects/court-booker/healthz`, expecting status 200, every 60 seconds.

### Update

```bash
~/homelab/dev/ai_projects/projects/court-booker/deploy/update-site.sh
```

To redeploy even though `main` hasn't changed: `COURT_BOOKER_FORCE=1 ~/homelab/dev/ai_projects/projects/court-booker/deploy/update-site.sh`.

Settings are environment variables with defaults; the scripts do not read `.env`:

| Variable | Default |
|----------|---------|
| `COURT_BOOKER_ENV_FILE` | `~/homelab/env/court-booker.env` |
| `COURT_BOOKER_DATA_DIR` | `~/homelab/data/court-booker` |
| `COURT_BOOKER_NETWORK` | `homelab_default` |
| `COURT_BOOKER_SRC_DIR` | `~/homelab/dev/ai_projects` |
| `COURT_BOOKER_REPO_URL` | `https://github.com/rickphobia/ai_projects.git` |
| `COURT_BOOKER_BRANCH` | `main` |
| `COURT_BOOKER_FORCE` | `0` |

### Roll back

```bash
~/homelab/dev/ai_projects/projects/court-booker/deploy/rollback.sh
```

Starts the previous image (recorded in `~/homelab/dev/court-booker.previous-tag`) the same way, health check included. Run it again to undo. The next `update-site.sh` run puts `main` back, so fix `main` first. Old images stay until you prune them; a pruned previous image can't be rolled back to.

### Check that it worked

```bash
curl -I https://rickphobia.com/ai-projects/court-booker/healthz   # expect HTTP 200
cat ~/homelab/dev/court-booker.deployed-tag                      # the commit that is live
docker ps --filter name=court-booker-                            # one container, healthy
```

Logs: `docker logs court-booker-<tag>-<n>`, or Dozzle.

## How it works

- `court-booker serve` (`cli.py`) loads the settings, sets up JSON logging and starts uvicorn with the app from `web/app.py`.
- The FastAPI app uses the path prefix as its `root_path`, so it works behind nginx forwarding `/ai-projects/court-booker/...` unchanged.
- `/healthz` needs no login. It returns `{"status": "ok", "database": "ok", "last_tick_seconds_ago": 3}` with 200, or `"status": "failing"` with 503 when the database can't be read or the scheduler has been quiet for `COURT_BOOKER_SCHEDULER_STALE_SECONDS`. A long run counts as activity: it beats after every attempt and every wait. It shows no Booking Request or Profile data.
- At startup `serve` opens the SQLite file and applies any schema migrations it hasn't had (`adapters/sqlite/database.py`, tracked with `PRAGMA user_version`). A file from a newer release is refused rather than guessed at.
- **Login** (`auth/`, `web/login_pages.py`): the password is checked against the scrypt hash. Success sets a signed session cookie (HttpOnly, SameSite=Strict, Secure, scoped to the prefix) holding only its issue time; the signature also covers the password hash, so changing the password logs every session out. Logout deletes the cookie. Sessions aren't stored on the server, so a cookie copied off a device stays valid until it expires; to cut off every session at once, change `COURT_BOOKER_SESSION_SECRET` and restart.
- **Who sees what:** `/login` and `/healthz` are public; every other page sits on a router guarded by `require_operator` and redirects a logged-out visitor to `/login`. New pages go on such a router (see `web/app.py`).
- **CSRF:** every page gives the browser a random nonce cookie and puts an HMAC of it in each form. An app-wide dependency rejects any POST whose token doesn't match with `403`.
- **Lockout:** each wrong password is stored in the `login_failures` table. When a wrong password makes `COURT_BOOKER_LOGIN_MAX_FAILURES` within `COURT_BOOKER_LOGIN_LOCKOUT_MINUTES`, every login is refused for the next `COURT_BOOKER_LOGIN_LOCKOUT_MINUTES`, the right password included. Refused attempts aren't counted, so nobody can stretch a lock; a successful login clears the count. It survives a restart because it's in the database. The count is shared, not per visitor: there is one Operator, so a stranger guessing can lock the Operator out too, for one lockout at a time.
- **Profile** (`profile/`, `adapters/sqlite/profile_store.py`, `web/profile_page.py`): the `/profile` page shows and saves friend B's first name, email, unit number and mobile. `parse_profile` checks every field (all required, an email shape, mobile digits only) and the page shows a message under each bad one. The Profile is stored as one row holding a Fernet token of its JSON, encrypted with `COURT_BOOKER_PROFILE_KEY` (decision 0003); the key is never in the database. Logs name the fields that failed, never their values.
- **Picktime** (`court_booking_site.py`, `adapters/picktime_browser/`): `CourtBookingSite.book(date, slot, profile, dry_run=...)` books one Slot and returns a `SlotAttempt`: the outcome (`Booked`, `Taken`, `NotOpen`, `NetworkError` with the step, `Rejected` with Picktime's text, or `ReadyToBook` for a dry run), the screenshot path and the duration. The Playwright adapter starts a fresh headless Chromium for each attempt, with a normal desktop Chrome user agent and the venue's timezone. It opens the page, picks the Court, then the date (missing or greyed out means `NotOpen`), then the Slot. If the date has no Slots it's `NotOpen`; if it has Slots but not this one, `Taken`. It fills the fields by their labels (First Name, Email Id, Unit Number, Mobile), clicks Book, and reads the confirmation (`Booked`) or Picktime's "Oops!" dialog (`Taken` when it says the Slot is no longer available, otherwise `Rejected`). Any Playwright error or timeout is a `NetworkError` naming the step it happened in. The selectors come from the live page as read on 2026-10-06; the error texts after Book are guesses until a real booking fails.

- **Booking Requests** (`booking_requests/`, `schedule/`, `adapters/sqlite/booking_request_store.py`, `web/booking_request_pages.py`): the home page lists them, today and later first (soonest at the top), then past dates. `/requests/new` takes a date and one or more ticked Slots. `BookingRequests` checks the rules and raises a typed error with the message the page shows: a Profile must exist, the date can't be in the past (judged in venue time), at least one Slot, only configured Slots, and one live request per date (a unique index on non-Cancelled rows, so a cancelled date can be requested again). The run time is chosen once, at creation, by `schedule.run_time`: the date's Release Time plus a random jitter, or a short delay from now when the date is already open. It is stored in UTC and shown in venue time; editing the Slots keeps it, and the date can't be edited (cancel and create a new one instead). Edit and cancel work only while the request is Waiting (and editing stops once the date has passed); the status check and the change are one database step, so the scheduler can't claim a request half-way through an edit. Logs carry the request id, date, Slots and run time, never Profile data.
- **Booking at Release Time** (`scheduler/`, `booking_run/`): when the app starts, a background thread runs one scheduler tick at once and then one every `COURT_BOOKER_SCHEDULER_TICK_SECONDS`. A tick claims the earliest due Waiting request, moving it to Booking… in one locked database step (so no request is ever run twice, and edit and cancel are refused from then on), runs it, marks it Done, and repeats until nothing is due. A run decrypts the Profile then (so Profile edits reach waiting requests) and tries each Slot in time order, with a random pause between them. Each Slot's status is saved as soon as it's known:
  - **Booked**: Picktime confirmed it.
  - **Taken**: someone else has it. Never retried.
  - **Failed**, with a reason: a network error still failing after `COURT_BOOKER_RETRY_COUNT` retries (waiting longer each time); Picktime's own refusal text (not retried); "date not open on Picktime yet" (that Slot and every later one, without asking Picktime again: the Booking Window setting is probably wrong). Within `COURT_BOOKER_NOT_OPEN_GRACE_SECONDS` of Release Time a closed date is first tried again every `COURT_BOOKER_RETRY_BACKOFF_SECONDS`, in case Picktime opens it a few seconds late; each try is logged as `date not open yet, trying again` with `seconds_since_release`; or a Profile that can't be read; "missed" or "interrupted, check Picktime" (below).

  One Slot's result never stops the others. Once a request has started, the list shows each Slot's status, when it was tried, and a link to its screenshot.
- **Recovery and cleanup** (`scheduler/`): what the statuses mean after downtime.
  - **Ran late**: a request claimed more than 5 minutes after its run time (the server was down) still runs; the list says "Ran late" with the time it actually ran.
  - **Missed**: a Waiting request whose date has passed (venue time) becomes Done with every Slot Failed "missed". It is never tried.
  - **Interrupted**: at startup, a request still in Booking… was cut short by a crash or restart. It is never re-run (a Slot may already be booked); it becomes Done and every Slot without an outcome is Failed "interrupted, check Picktime".
  - Every tick deletes Booking Requests, their Slot results and screenshot files dated more than `COURT_BOOKER_RETENTION_DAYS` before today.
- **Screenshots** (`web/booking_request_pages.py`): `/requests/<id>/slots/<HH:MM>/screenshot` serves a tried Slot's screenshot to the logged-in Operator only. It looks the path up in the database (the URL never names a file) and serves it only if it lies inside `COURT_BOOKER_SCREENSHOT_DIR`.

The full design is in `docs/spec.md`.

## Folder layout

```
src/court_booker/
  config.py          # settings from env vars, validated at startup
  json_logging.py    # JSON-lines log format on stdout
  clock.py           # the current time, faked in tests
  random_source.py   # random choices, fixed in tests
  court_booking_site.py  # the interface for booking one Slot, and its outcomes
  cli.py             # entrypoint: `court-booker serve`, `hash-password` and `dry-run`
  auth/              # password hashes, session cookies and CSRF tokens, login lockout
  profile/           # the Profile value and its validation rules
  booking_requests/  # Booking Request rules: create, edit Slots, cancel, list order
  booking_run/       # runs one claimed request: each Slot in order, retries, outcomes
  scheduler/         # the tick (claim due requests, run them), its health, the background loop
  schedule/          # Release Time and run time, pure functions
  adapters/picktime_browser/  # books a Slot through the real Picktime page (Playwright)
  adapters/sqlite/   # the database file, migrations, login failures, encrypted Profile, Booking Requests
  web/app.py         # FastAPI app wiring and /healthz
  web/access.py      # session and CSRF checks, page rendering
  web/*_page(s).py   # pages, with their templates in web/templates/
tests/               # mirrors src/
scripts/
  docker-smoke-test.sh
  update-site.test.sh  # update-site.sh uses the settings of the commit it deploys (fake docker)
deploy/
  update-site.sh     # build main, swap the container once /healthz passes
  rollback.sh        # start the previous image again
  settings.sh        # settings and the swap, shared by both
Dockerfile
docs/                # spec, tickets, decisions
```

## Debugging

- Logs are JSON lines on stdout (`docker logs <container>`, or Dozzle on the server). Each line has `time` (UTC), `level`, `logger`, `message` and any extra fields.
- Set `COURT_BOOKER_LOG_LEVEL=DEBUG` for more detail.
- If the app exits at once with `invalid configuration: ...`, the message names the variable to fix.
- If the container runs but is unreachable, check `COURT_BOOKER_HOST` is `0.0.0.0` inside it.
- Logins are logged: `operator logged in` (info), `login failed: wrong password` and `login refused: locked out ...` (warning), each with the client address. Passwords are never logged.
- Logged in but sent straight back to the login page: over plain http, set `COURT_BOOKER_SECURE_COOKIES=false`; otherwise check you used the prefixed URL.
- Locked out: wait the lockout minutes, or, on the server, clear it with `sqlite3 <database file> 'DELETE FROM login_failures'`.
- The Profile page fails with `ProfileUnreadable` in the logs: `COURT_BOOKER_PROFILE_KEY` isn't the key the Profile was saved with. Restore the old key, or delete the row (`sqlite3 <database file> 'DELETE FROM profile'`) and enter the Profile again.
- A Booking Request shows an unexpected run time: check `COURT_BOOKER_VENUE_TIMEZONE`, `COURT_BOOKER_BOOKING_WINDOW_DAYS` and the jitter settings. A changed setting applies only to requests created after it; existing ones keep the run time stored at creation. The `booking request created` log line has the `run_at` (UTC) that was chosen.
- A form answers `403 The form expired`: its CSRF token no longer matches the browser's cookie (for example after cookies were cleared). Reload the page and submit again.
- Picktime attempts log one line per step (`picktime: open page`, `pick court`, `pick date`, `pick slot`, `fill form`, `submit`, `read result`, each with `date`, `slot` and `step`), then `picktime attempt finished` with the outcome, duration and screenshot path. Profile values are never logged. A failure logs `picktime step failed: <step>: <Playwright's message>`; open the screenshot to see what the page showed.
- Every attempt ends in `NetworkError` at `pick court`, `pick date` or `fill form`: Picktime has probably changed its page. Run `dry-run`, look at the screenshot, and compare the page with the selectors in `adapters/picktime_browser/picktime_site.py`.
- A night's run, from the logs: `booking request claimed`, `booking run started`, then per attempt `slot attempt finished` (with `request_id`, `play_date`, `slot`, `outcome`, `retry`, `step`, `detail`, `duration_seconds`) and per Slot `slot result: <status>` with the `reason`, then `booking run finished`. A tick that fails logs `scheduler tick failed` with the traceback; the loop keeps going.
- `/healthz` answers 503 with `"database": "unreachable"`: the SQLite file is missing or unreadable (check the data volume). With `"database": "ok"` and a large `last_tick_seconds_ago`: the scheduler thread is stuck; its last log lines show where, and a restart starts a new one.
- `Executable doesn't exist` from Playwright: run `uv run playwright install --only-shell chromium` (locally) or rebuild the image.

## Decisions

See `docs/decisions/` for why things are the way they are.
