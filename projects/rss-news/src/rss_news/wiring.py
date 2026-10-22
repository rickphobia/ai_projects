"""Puts the app together: the stores, the features and the tick, over the given adapters.

The one place that decides which store each feature uses, shared by `rss-news serve` and the
tests, so tests run the same app with fakes for the outside world.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import timedelta
from typing import Protocol

from fastapi import FastAPI

from rss_news.adapters.sqlite.alerts import SqliteAlertDecisions, SqlitePushSubscriptions
from rss_news.adapters.sqlite.briefings import SqliteBriefings
from rss_news.adapters.sqlite.chat import SqliteChats
from rss_news.adapters.sqlite.database import SqliteDatabase
from rss_news.adapters.sqlite.items import SqliteItems
from rss_news.adapters.sqlite.login_failures import SqliteLoginFailures
from rss_news.adapters.sqlite.notes import SqliteNotes
from rss_news.adapters.sqlite.sources import SqliteSources
from rss_news.adapters.sqlite.spending import SqliteSpending
from rss_news.adapters.sqlite.stocks import SqliteStocks
from rss_news.alerts.push import AlertPush, PushSender
from rss_news.alerts.rules import AlertLimits, AlertRules
from rss_news.briefings.briefing import BriefingModel
from rss_news.briefings.writing import Briefings
from rss_news.chat.chatting import Chats
from rss_news.chat.conversation import ChatModel
from rss_news.clock import Clock
from rss_news.config import Settings
from rss_news.dictionary.lookup import Dictionary, DictionaryModel
from rss_news.items.inbox import Inbox, OldItemCleanup
from rss_news.items.reading import ArticleExtractor, ItemReading
from rss_news.jobs.running import Jobs
from rss_news.newsletters.collecting import Mailbox, Newsletters
from rss_news.notes.notes import Notes
from rss_news.scoring.item_scoring import ItemScoring, ScoringModel
from rss_news.simple_summaries.summarising import SimpleSummaries, SimpleSummaryModel
from rss_news.sources.catalog import StarterFolder, load_starter_sources
from rss_news.sources.fetching import FeedFetcher, SourceFetching
from rss_news.sources.managing import SourceManagement
from rss_news.sources.polite_queue import FetchPacing
from rss_news.spending.ledger import SpendingLedger
from rss_news.spending.limit import SpendingLimit
from rss_news.stocks.owner_stocks import Stocks
from rss_news.tick import Tick, TickLoop, TickStep
from rss_news.web.app import create_app

TICK_INTERVAL = timedelta(minutes=1)


class LanguageModel(
    ScoringModel, BriefingModel, ChatModel, DictionaryModel, SimpleSummaryModel, Protocol
):
    """Every job the app gives the language model."""


@dataclass(frozen=True)
class Wiring:
    app: FastAPI
    # Tests run it by hand; `rss-news serve` runs it every minute in the background.
    tick: Tick
    ledger: SpendingLedger
    stocks: Stocks
    # The running and recently finished Briefings and Chat answers.
    jobs: Jobs


def build_app(
    settings: Settings,
    *,
    database: SqliteDatabase,
    feed_fetcher: FeedFetcher,
    language_model: LanguageModel,
    article_extractor: ArticleExtractor,
    push_sender: PushSender | None,
    mailbox: Mailbox | None,
    clock: Clock,
    starter_folders: Sequence[StarterFolder],
    run_tick_loop: bool,
) -> Wiring:
    """Build the app over a migrated database, loading the starter Sources on first run.

    Without a push sender (no VAPID key configured) Alerts are off and say so; without a
    mailbox (no newsletter Gmail configured) the tick doesn't read newsletters.
    """
    sources = SqliteSources(database)
    items = SqliteItems(database, clock)
    load_starter_sources(sources, starter_folders)
    stocks = Stocks(SqliteStocks(database), clock)
    # Puts back a ticker Source the owner deleted by hand, so each stock always has one.
    stocks.keep_ticker_sources()
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
    limit = SpendingLimit(
        ledger, clock, timezone=settings.timezone, monthly_limit_usd=settings.monthly_limit_usd
    )
    scoring = ItemScoring(
        store=items,
        model=language_model,
        owner_tickers=stocks,
        ledger=ledger,
        clock=clock,
        batch_size=settings.scoring_batch_size,
        prompt_token_limit=settings.scoring_prompt_token_limit,
    )
    inbox = Inbox(items)
    alert_push = AlertPush(
        store=SqlitePushSubscriptions(database), sender=push_sender, inbox=inbox, clock=clock
    )
    alert_rules = AlertRules(
        store=SqliteAlertDecisions(database),
        push=alert_push,
        clock=clock,
        limits=AlertLimits(
            quiet_hours=settings.alert_quiet_hours,
            daily_cap=settings.alert_daily_cap,
            timezone=settings.timezone,
        ),
    )
    newsletter_steps = (
        [
            TickStep(
                "read newsletters",
                Newsletters(mailbox=mailbox, sources=sources, items=items, clock=clock).collect,
            )
        ]
        if mailbox
        else []
    )
    tick = Tick(
        [
            TickStep("fetch due sources", fetching.fetch_due),
            *newsletter_steps,
            TickStep("score new items", scoring.score_new),
            TickStep("send alerts", alert_rules.send_due),
            TickStep(
                "delete old items",
                OldItemCleanup(items, clock, settings.item_max_age).delete_old,
            ),
        ],
        clock,
    )
    item_reading = ItemReading(items=items, extractor=article_extractor, clock=clock)
    jobs = Jobs()
    app = create_app(
        settings,
        database=database,
        login_failures=SqliteLoginFailures(database),
        clock=clock,
        inbox=inbox,
        item_reading=item_reading,
        source_management=SourceManagement(sources=sources, fetcher=feed_fetcher),
        stocks=stocks,
        briefings=Briefings(
            store=SqliteBriefings(database),
            model=language_model,
            extractor=article_extractor,
            ledger=ledger,
            limit=limit,
            clock=clock,
            timezone=settings.timezone,
            model_name=settings.briefing_model,
            token_budget=settings.briefing_token_budget,
            importance_cutoff=settings.briefing_importance_cutoff,
        ),
        chats=Chats(
            store=SqliteChats(database),
            model=language_model,
            ledger=ledger,
            limit=limit,
            clock=clock,
            timezone=settings.timezone,
        ),
        dictionary=Dictionary(model=language_model, ledger=ledger, limit=limit),
        simple_summaries=SimpleSummaries(
            items=item_reading, model=language_model, ledger=ledger, limit=limit
        ),
        notes=Notes(SqliteNotes(database), clock),
        spending=limit,
        alert_push=alert_push,
        alert_limits=alert_rules.limits,
        jobs=jobs,
        tick=tick,
        background=(TickLoop(tick, TICK_INTERVAL),) if run_tick_loop else (),
    )
    return Wiring(app=app, tick=tick, ledger=ledger, stocks=stocks, jobs=jobs)
