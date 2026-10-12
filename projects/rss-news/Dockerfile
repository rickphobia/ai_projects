# Two stages (decision 0002): Node builds the PWA, then the Python image runs the app and serves
# the built files. Bump each tag and its digest together.

FROM node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS pwa

WORKDIR /pwa
# Dependencies first, so code changes don't reinstall them.
COPY pwa/package.json pwa/package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY pwa/ ./
RUN npm run build


FROM python:3.13.9-slim-bookworm@sha256:b685a4fa58bb19d1814d78a1ec0f0208f351452724f78b20212c984d6e124a34

COPY --from=ghcr.io/astral-sh/uv:0.9.13 /uv /usr/local/bin/uv

ENV UV_PYTHON_DOWNLOADS=never \
    UV_PYTHON=python3.13 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --locked --no-dev --no-install-project

COPY src ./src
RUN uv sync --locked --no-dev

COPY --from=pwa /pwa/dist ./pwa

ENV PATH=/app/.venv/bin:$PATH \
    RSS_NEWS_HOST=0.0.0.0 \
    RSS_NEWS_PORT=8000 \
    RSS_NEWS_DATABASE_PATH=/app/data/rss-news.sqlite3 \
    RSS_NEWS_PWA_DIR=/app/pwa

# The SQLite file lives here; the server mounts a volume over it so data survives redeploys.
RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin app \
    && mkdir /app/data && chown app:app /app/data
USER app
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import os, urllib.request; urllib.request.urlopen(f\"http://127.0.0.1:{os.environ['RSS_NEWS_PORT']}/healthz\", timeout=4)"]

CMD ["rss-news", "serve"]
