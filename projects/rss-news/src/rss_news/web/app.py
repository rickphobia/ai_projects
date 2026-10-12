"""Builds the FastAPI app from validated Settings and the adapters it uses."""

from typing import Protocol

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response

from rss_news.config import Settings


class DatabaseHealth(Protocol):
    def is_reachable(self) -> bool: ...


def create_app(settings: Settings, *, database: DatabaseHealth) -> FastAPI:
    # root_path makes routes match both behind nginx (/ai-projects/rss-news/healthz) and
    # directly (/healthz), and makes generated links carry the prefix.
    app = FastAPI(
        title="rss-news",
        root_path=settings.root_path,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )

    @app.get("/healthz")
    def healthz() -> Response:
        reachable = database.is_reachable()
        return JSONResponse(
            {
                "status": "ok" if reachable else "failing",
                "database": "ok" if reachable else "unreachable",
            },
            status_code=200 if reachable else 503,
        )

    # Mounted last so API routes win; everything else is the PWA's files.
    app.mount("/", StaticFiles(directory=settings.pwa_dir, html=True), name="pwa")
    return app
