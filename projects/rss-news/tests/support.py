"""Shared test helpers: a stand-in PWA build and the environment the app needs."""

from collections.abc import Callable, Sequence
from datetime import UTC, datetime, timedelta
from pathlib import Path

from rss_news.adapters.sqlite.database import SqliteDatabase
from rss_news.auth.passwords import hash_password
from rss_news.config import Settings
from rss_news.scoring.item_scoring import ItemScore, ScoringFailed, ScoringResult, UnscoredItem
from rss_news.sources.catalog import StarterFolder
from rss_news.sources.fetching import FeedRequest, FetchFailed, FetchResult
from rss_news.spending.ledger import AiUsage
from rss_news.wiring import Wiring, build_app

PREFIX = "/ai-projects/rss-news"
OWNER_PASSWORD = "correct horse battery staple"
# A cheap scrypt cost keeps the tests fast; production hashes use the default cost.
OWNER_PASSWORD_HASH = str(hash_password(OWNER_PASSWORD, cost=2**10))
SESSION_SECRET = "s" * 32
PWA_INDEX = "<!doctype html><title>rss-news test build</title>"


def fake_pwa_build(folder: Path) -> Path:
    """A folder shaped like `npm run build` output, so tests don't need Node."""
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "index.html").write_text(PWA_INDEX)
    (folder / "assets").mkdir(exist_ok=True)
    (folder / "assets" / "main.js").write_text("console.log('rss-news');")
    return folder


def app_env(tmp_path: Path, **overrides: str) -> dict[str, str]:
    """The smallest environment load_settings accepts, pointing at files under `tmp_path`."""
    return {
        "RSS_NEWS_PWA_DIR": str(fake_pwa_build(tmp_path / "pwa")),
        "RSS_NEWS_DATABASE_PATH": str(tmp_path / "rss-news.sqlite3"),
        "RSS_NEWS_PASSWORD_HASH": OWNER_PASSWORD_HASH,
        "RSS_NEWS_SESSION_SECRET": SESSION_SECRET,
        # The test client talks plain http.
        "RSS_NEWS_SECURE_COOKIES": "false",
        "RSS_NEWS_ANTHROPIC_API_KEY": "sk-ant-test-not-a-real-key",
        **overrides,
    }


class FakeClock:
    def __init__(self, start: datetime = datetime(2026, 10, 12, 12, 0, tzinfo=UTC)) -> None:
        self.current = start

    def now(self) -> datetime:
        return self.current

    def advance(self, delta: timedelta) -> None:
        self.current += delta


class FakeFeedFetcher:
    """Answers each feed URL with what the test set for it; other URLs fail to connect."""

    def __init__(self) -> None:
        self.answers: dict[str, FetchResult] = {}
        self.requests: list[FeedRequest] = []

    def fetch(self, request: FeedRequest) -> FetchResult:
        self.requests.append(request)
        return self.answers.get(request.url, FetchFailed("connect", "no answer set in the test"))


type ScoringAnswer = Callable[[Sequence[UnscoredItem]], ScoringResult]


class FakeLanguageModel:
    """Scores each Item with what `answer` returns; by default Importance 3 and a summary
    made from the title. Usage is scripted, so ledger rows can be checked exactly."""

    USAGE = AiUsage(
        model="claude-haiku-5-5",
        input_tokens=10_000,
        output_tokens=2_000,
        web_searches=0,
        duration=timedelta(seconds=3),
    )

    def __init__(self) -> None:
        self.calls: list[list[UnscoredItem]] = []
        self.answer: ScoringAnswer = self.score_all
        # Items whose title contains one of these make their whole call fail.
        self.failing_titles: set[str] = set()

    def score_items(self, items: Sequence[UnscoredItem]) -> ScoringResult:
        self.calls.append(list(items))
        if any(word in item.title for item in items for word in self.failing_titles):
            raise ScoringFailed("scripted failure", self.USAGE)
        return self.answer(items)

    @classmethod
    def score_all(cls, items: Sequence[UnscoredItem]) -> ScoringResult:
        scores = [ItemScore(item.id, 3, f"Summary of {item.title}") for item in items]
        return ScoringResult(scores, cls.USAGE)


def make_wiring(
    settings: Settings,
    clock: FakeClock,
    *,
    feed_fetcher: FakeFeedFetcher | None = None,
    language_model: FakeLanguageModel | None = None,
    starter_folders: Sequence[StarterFolder] = (),
) -> Wiring:
    """The whole app over the settings' database file, with fakes for the outside world.

    A second call over the same file is the app after a restart.
    """
    database = SqliteDatabase(settings.database_path)
    database.migrate()
    return build_app(
        settings,
        database=database,
        feed_fetcher=feed_fetcher or FakeFeedFetcher(),
        language_model=language_model or FakeLanguageModel(),
        clock=clock,
        starter_folders=starter_folders,
        run_tick_loop=False,
    )
