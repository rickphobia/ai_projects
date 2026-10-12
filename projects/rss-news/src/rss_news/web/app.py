"""Builds the FastAPI app from validated Settings and the adapters it uses."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Protocol

from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response

from rss_news.alerts.push import AlertPush
from rss_news.auth.login import LoginFailures, OwnerLogin
from rss_news.auth.sessions import SessionSigner
from rss_news.briefings.writing import Briefings
from rss_news.chat.chatting import Chats
from rss_news.clock import Clock
from rss_news.config import Settings
from rss_news.items.inbox import Inbox
from rss_news.items.reading import ItemReading
from rss_news.sources.managing import SourceManagement
from rss_news.spending.limit import SpendingLimit
from rss_news.web.alerts import alerts_router
from rss_news.web.auth import Access, public_router, require_session, session_router
from rss_news.web.briefings import briefings_router
from rss_news.web.chats import chats_router
from rss_news.web.inbox import inbox_router
from rss_news.web.items import items_router
from rss_news.web.sources import sources_router
from rss_news.web.spending import spending_router


class DatabaseHealth(Protocol):
    def is_reachable(self) -> bool: ...


class TickHealth(Protocol):
    def last_success(self) -> datetime | None: ...


class BackgroundJob(Protocol):
    """Work that runs beside the web server, started and stopped with it."""

    def start(self) -> None: ...

    def stop(self) -> None: ...


def create_app(
    settings: Settings,
    *,
    database: DatabaseHealth,
    login_failures: LoginFailures,
    clock: Clock,
    inbox: Inbox,
    item_reading: ItemReading,
    source_management: SourceManagement,
    briefings: Briefings,
    chats: Chats,
    spending: SpendingLimit,
    alert_push: AlertPush,
    tick: TickHealth,
    background: tuple[BackgroundJob, ...] = (),
) -> FastAPI:
    @asynccontextmanager
    async def run_background(_: FastAPI) -> AsyncIterator[None]:
        for job in background:
            job.start()
        yield
        for job in background:
            job.stop()

    # root_path makes routes match both behind nginx (/ai-projects/rss-news/healthz) and
    # directly (/healthz), and makes generated links carry the prefix.
    app = FastAPI(
        title="rss-news",
        root_path=settings.root_path,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        lifespan=run_background,
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
    app.state.inbox = inbox
    app.state.item_reading = item_reading
    app.state.source_management = source_management
    app.state.briefings = briefings
    app.state.chats = chats
    app.state.spending = spending
    app.state.alert_push = alert_push

    @app.get("/healthz")
    def healthz() -> Response:
        reachable = database.is_reachable()
        last_tick = tick.last_success()
        return JSONResponse(
            {
                "status": "ok" if reachable else "failing",
                "database": "ok" if reachable else "unreachable",
                # None until the first tick succeeds. A number that keeps growing means the
                # tick is stuck or every run has a failing step: see the "tick step failed" logs.
                "last_tick_seconds_ago": (
                    None if last_tick is None else int((clock.now() - last_tick).total_seconds())
                ),
            },
            status_code=200 if reachable else 503,
        )

    app.include_router(public_router)
    # Every other API route needs a session: include feature routers with this dependency.
    for router in (
        session_router,
        inbox_router,
        items_router,
        sources_router,
        briefings_router,
        chats_router,
        spending_router,
        alerts_router,
    ):
        app.include_router(router, dependencies=[Depends(require_session)])

    # Mounted last so API routes win; everything else is the PWA's files. They hold no data
    # and include the login screen, so they need no session.
    app.mount("/", StaticFiles(directory=settings.pwa_dir, html=True), name="pwa")
    return app
