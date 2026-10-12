# 02: Deploy to the Beelink

**What to build:** The owner can release rss-news to `rickphobia.com/ai-projects/rss-news/` and roll it back with the same scripts and steps as court-booker, and can try any PR on the server before merging it. Spec user story 85.

**Blocked by:** 01 (Walking skeleton)

**Status:** done

**Touches:** deploy, scripts/try-pr

**Effort:** low

- [x] `deploy/update-site.sh` builds `main` in its own checkout under `~/homelab/dev`, swaps the container in, keeps the SQLite volume, and checks `/healthz` before declaring success
- [x] `deploy/rollback.sh` returns to the previous image
- [x] Shared deploy settings live in one file, as in court-booker
- [x] rss-news added to `scripts/try-pr.sh` so a PR can be previewed on the server
- [x] README "Deploy" section explains first-time setup (secrets file, nginx proxy entry, volume) and each script

**Owner steps:** add the nginx proxy entry for `/ai-projects/rss-news/`, create the secrets file on the Beelink, and run `deploy/update-site.sh`.
