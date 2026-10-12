# 03: Sign in

**What to build:** The owner signs in with one password and stays signed in on their phone for weeks; anyone else only sees the login screen. Repeated wrong passwords are slowed down. Every page and API call except login and `/healthz` needs a session. Follows court-booker's auth. Spec user stories 1–4.

**Blocked by:** 01 (Walking skeleton)

**Status:** ready

**Touches:** auth, web/auth, adapters/sqlite/auth, pwa/login, pwa/api-client, pwa/shell

**Effort:** low

- [ ] `hash-password` subcommand prints a password hash; the hash and the session secret come from config, never from the repo
- [ ] Login and logout API calls; signed, HttpOnly, SameSite=Strict session cookie with a configurable lifetime
- [ ] Every API call except login and `/healthz` answers 401 without a session
- [ ] Repeated failures are slowed down or locked out for a configured time, stored in SQLite so a restart doesn't reset them
- [ ] SQLite adapter applies schema migrations at startup (first table: login failures)
- [ ] PWA login screen; the one API client module sends the cookie and sends the owner to login on a 401
- [ ] Logins logged at the right level, never with the password
- [ ] Tests through the test client cover login, logout, 401, lockout and lockout expiry with the fake Clock; a Vitest test covers the login screen
- [ ] README and `.env.example` updated
