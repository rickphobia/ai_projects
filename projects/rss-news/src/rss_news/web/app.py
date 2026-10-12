"""Builds the FastAPI app from validated Settings and the adapters it uses."""

from typing import Protocol

from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response

from rss_news.auth.login import LoginFailures, OwnerLogin
from rss_news.auth.sessions import SessionSigner
from rss_news.clock import Clock
from rss_news.config import Settings
from rss_news.web.auth import Access, public_router, require_session, session_router


class DatabaseHealth(Protocol):
    def is_reachable(self) -> bool: ...


def create_app(
    settings: Settings,
    *,
    database: DatabaseHealth,
    login_failures: LoginFailures,
    clock: Clock,
) -> FastAPI:
    # root_path makes routes match both behind nginx (/ai-projects/rss-news/healthz) and
    # directly (/healthz), and makes generated links carry the prefix.
    app = FastAPI(
        title="rss-news",
        root_path=settings.root_path,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.state.access = Access(
        login=OwnerLogin(
            password_hash=settings.password_hash,
            failures=login_failures,
            clock=clock,
            max_failures=settings.login_max_failures,
            lockout=settings.login_lockout,
        ),
        sessions=SessionSigner(
            secret=settings.session_secret,
            password_hash=str(settings.password_hash),
            lifetime=settings.session_lifetime,
        ),
        clock=clock,
        secure_cookies=settings.secure_cookies,
        cookie_path=settings.root_path or "/",
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

    app.include_router(public_router)
    # Every other API route needs a session: include feature routers with this dependency.
    app.include_router(session_router, dependencies=[Depends(require_session)])

    # Mounted last so API routes win; everything else is the PWA's files. They hold no data
    # and include the login screen, so they need no session.
    app.mount("/", StaticFiles(directory=settings.pwa_dir, html=True), name="pwa")
    return app
