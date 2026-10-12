# Python API with a TypeScript PWA, in one container

rss-news runs like court-booker: one Docker container with Python, FastAPI, SQLite on a mounted volume and an in-process scheduler. Unlike court-booker, its pages are a TypeScript PWA built with Vite, not server-rendered templates. The PWA is built inside the image and served by FastAPI under the path prefix. The app needs push notifications (a service worker), app shortcuts, a text-selection popup and a Chat that streams its answers, and those are much easier in a client app. Python stays on the backend because its feed parsing (feedparser) and article extraction (trafilatura) are better than the Node options.

**Trade-offs:** two languages and two toolchains in one project, so CI runs both, and the Docker build has a Node stage.
