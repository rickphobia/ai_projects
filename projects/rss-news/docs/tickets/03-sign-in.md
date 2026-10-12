# 03: Sign in

**What to build:** The owner signs in with one password and stays signed in on their phone for weeks; anyone else only sees the login screen. Repeated wrong passwords are slowed down. Every page and API call except login and `/healthz` needs a session. Follows court-booker's auth. Spec user stories 1–4.

**Blocked by:** 01 (Walking skeleton)

**Status:** done

**Touches:** auth, web/auth, adapters/sqlite/auth, pwa/login, pwa/api-client, pwa/shell

**Effort:** low

- [x] `hash-password` subcommand prints a password hash; the hash and the session secret come from config, never from the repo
- [x] Login and logout API calls; signed, HttpOnly, SameSite=Strict session cookie with a configurable lifetime
- [x] Every API call except login and `/healthz` answers 401 without a session
- [x] Repeated failures are slowed down or locked out for a configured time, stored in SQLite so a restart doesn't reset them
- [x] SQLite adapter applies schema migrations at startup (first table: login failures)
- [x] PWA login screen; the one API client module sends the cookie and sends the owner to login on a 401
- [x] Logins logged at the right level, never with the password
- [x] Tests through the test client cover login, logout, 401, lockout and lockout expiry with the fake Clock; a Vitest test covers the login screen
- [x] README and `.env.example` updated
