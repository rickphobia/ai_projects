# 19: Installable app

**What to build:** The owner installs rss-news to their Android home screen from Chrome, and it opens like an app. Spec user story 72.

**Blocked by:** 03 (Sign in)

**Status:** ready

**Touches:** pwa/manifest, pwa/service-worker

**Effort:** low

- [ ] Web app manifest scoped to the path prefix, with name, icons and theme colours
- [ ] Service worker caches the app shell only, never API responses
- [ ] A new release replaces the cached shell on the next open
- [ ] The smoke test checks the manifest and service worker are served under the prefix

**Owner steps:** install the app from Chrome on the Honor 400 Pro after deploying.
