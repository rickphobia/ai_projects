"""Puts the app together: the stores, the features and the tick, over the given adapters.

The one place that decides which store each feature uses, shared by `rss-news serve` and the
tests, so tests run the same app with fakes for the outside world.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import timedelta

from fastapi import FastAPI

from rss_news.adapters.sqlite.database import SqliteDatabase
from rss_news.adapters.sqlite.items import SqliteItems
from rss_news.adapters.sqlite.login_failures import SqliteLoginFailures
from rss_news.adapters.sqlite.sources import SqliteSources
from rss_news.adapters.sqlite.spending import SqliteSpending
from rss_news.clock import Clock
from rss_news.config import Settings
from rss_news.items.inbox import Inbox
from rss_news.items.reading import ArticleExtractor, ItemReading
from rss_news.scoring.item_scoring import ItemScoring, ScoringModel
from rss_news.sources.catalog import StarterFolder, load_starter_sources
from rss_news.sources.fetching import FeedFetcher, SourceFetching
from rss_news.sources.managing import SourceManagement
from rss_news.sources.polite_queue import FetchPacing
from rss_news.spending.ledger import SpendingLedger
from rss_news.tick import Tick, TickLoop, TickStep
from rss_news.web.app import create_app

TICK_INTERVAL = timedelta(minutes=1)


@dataclass(frozen=True)
class Wiring:
    app: FastAPI
    # Tests run it by hand; `rss-news serve` runs it every minute in the background.
    tick: Tick
    ledger: SpendingLedger


def build_app(
    settings: Settings,
    *,
    database: SqliteDatabase,
    feed_fetcher: FeedFetcher,
    language_model: ScoringModel,
    article_extractor: ArticleExtractor,
    clock: Clock,
    starter_folders: Sequence[StarterFolder],
    run_tick_loop: bool,
) -> Wiring:
    """Build the app over a migrated database, loading the starter Sources on first run."""
    sources = SqliteSources(database)
    items = SqliteItems(database, clock)
    load_starter_sources(sources, starter_folders)
    fetching = SourceFetching(
        sources=sources,
        items=items,
        fetcher=feed_fetcher,
        clock=clock,
        pacing=FetchPacing(
            interval=settings.fetch_interval,
            reddit_gap=settings.reddit_gap,
            reddit_interval=settings.reddit_interval,
            max_backoff=settings.fetch_max_backoff,
        ),
    )
    ledger = SpendingLedger(
        SqliteSpending(database),
        clock,
        prices=settings.model_prices,
        web_search_price_usd=settings.web_search_price_usd,
    )
    scoring = ItemScoring(
        store=items,
        model=language_model,
        ledger=ledger,
        clock=clock,
        batch_size=settings.scoring_batch_size,
        prompt_token_limit=settings.scoring_prompt_token_limit,
    )
    tick = Tick(
        [
            TickStep("fetch due sources", fetching.fetch_due),
            TickStep("score new items", scoring.score_new),
        ],
        clock,
    )
    app = create_app(
        settings,
        database=database,
        login_failures=SqliteLoginFailures(database),
        clock=clock,
        inbox=Inbox(items),
        item_reading=ItemReading(items=items, extractor=article_extractor, clock=clock),
        source_management=SourceManagement(sources=sources, fetcher=feed_fetcher),
        tick=tick,
        background=(TickLoop(tick, TICK_INTERVAL),) if run_tick_loop else (),
    )
    return Wiring(app=app, tick=tick, ledger=ledger)
