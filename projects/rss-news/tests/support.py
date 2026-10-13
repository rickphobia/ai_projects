"""Shared test helpers: a stand-in PWA build and the environment the app needs."""

from collections.abc import Callable, Sequence
from datetime import UTC, datetime, timedelta
from pathlib import Path

from rss_news.adapters.sqlite.database import SqliteDatabase
from rss_news.alerts.push import Alert, Delivery, PushFailed, PushSubscription
from rss_news.auth.passwords import hash_password
from rss_news.briefings.briefing import (
    BriefingFailed,
    SectionRequest,
    SectionResult,
    WrittenPoint,
)
from rss_news.chat.conversation import (
    ChatFailed,
    ChatInput,
    ChatStep,
    ItemSearch,
    ModelAnswer,
    SearchCall,
)
from rss_news.config import Settings
from rss_news.dictionary.lookup import (
    DefinitionRequest,
    DefinitionResult,
    DictionaryFailed,
)
from rss_news.items.reading import ExtractionFailed, ReaderView
from rss_news.newsletters.collecting import MailMessage
from rss_news.scoring.item_scoring import (
    ItemScore,
    ScoringFailed,
    ScoringResult,
    ScoringUnavailable,
    UnscoredItem,
)
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

    def sleep(self, delta: timedelta) -> None:
        self.current += delta


class FakeFeedFetcher:
    """Answers each feed URL with what the test set for it; other URLs fail to connect.

    Given a clock, it records when each request was made and lets `took` pass during it.
    """

    def __init__(self, clock: FakeClock | None = None, took: timedelta = timedelta()) -> None:
        self.answers: dict[str, FetchResult] = {}
        self.requests: list[FeedRequest] = []
        self.asked_at: list[tuple[str, datetime]] = []
        self._clock = clock
        self._took = took

    def fetch(self, request: FeedRequest) -> FetchResult:
        self.requests.append(request)
        if self._clock:
            self.asked_at.append((request.url, self._clock.now()))
            self._clock.advance(self._took)
        return self.answers.get(request.url, FetchFailed("connect", "no answer set in the test"))


class FakeArticleExtractor:
    """Answers each page URL with the Reader view the test set for it; others fail."""

    def __init__(self) -> None:
        self.pages: dict[str, ReaderView] = {}
        self.requested: list[str] = []

    def extract(self, url: str) -> ReaderView:
        self.requested.append(url)
        if url not in self.pages:
            raise ExtractionFailed("no article text was found on the page")
        return self.pages[url]


class FakePushSender:
    """Records each Alert it delivers. Endpoints in `gone` answer that the subscription no
    longer exists; those in `failing` can't be reached."""

    application_server_key = "BFakeApplicationServerKey"

    def __init__(self) -> None:
        self.delivered: list[tuple[PushSubscription, Alert]] = []
        self.gone: set[str] = set()
        self.failing: set[str] = set()

    def send(self, subscription: PushSubscription, alert: Alert) -> Delivery:
        if subscription.endpoint in self.failing:
            raise PushFailed("scripted outage")
        if subscription.endpoint in self.gone:
            return Delivery.GONE
        self.delivered.append((subscription, alert))
        return Delivery.DELIVERED


type ScoringAnswer = Callable[[Sequence[UnscoredItem]], ScoringResult]
type SectionAnswer = Callable[[SectionRequest], SectionResult]


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
        # The owner's tickers each scoring call was given.
        self.tickers_given: list[list[str]] = []
        self.answer: ScoringAnswer = self.score_all
        # Items whose title contains one of these make their whole call fail.
        self.failing_titles: set[str] = set()
        # When set, every call fails as if the API were down.
        self.unavailable = False
        self.sections: list[SectionRequest] = []
        self.section_answer: SectionAnswer = self.one_point_per_item
        # Sections of these Folders fail, after the model answered.
        self.failing_folders: set[str] = set()
        # What each continue_chat call answers, in turn: searches to run, an answer, or a
        # failure. Every call is recorded with the context it was given.
        self.chat_script: list[list[ItemSearch] | ModelAnswer | ChatFailed] = []
        self.chat_calls: list[tuple[str, ChatInput]] = []
        # What each Chat call reports it used; tests change it to add web searches.
        self.chat_usage = self.CHAT_USAGE
        self.definitions: list[DefinitionRequest] = []
        # When set, define_word raises it instead of answering.
        self.definition_failure: DictionaryFailed | None = None

    def define_word(self, request: DefinitionRequest) -> DefinitionResult:
        self.definitions.append(request)
        if self.definition_failure is not None:
            raise self.definition_failure
        return DefinitionResult(f"Meaning of {request.term}.", self.DEFINITION_USAGE)

    DEFINITION_USAGE = AiUsage(
        model="claude-haiku-5-5",
        input_tokens=400,
        output_tokens=60,
        web_searches=0,
        duration=timedelta(seconds=1),
    )

    def continue_chat(self, context: str, given: ChatInput) -> ChatStep:
        self.chat_calls.append((context, given))
        if not self.chat_script:
            raise AssertionError("the test scripted no more Chat steps")
        step = self.chat_script.pop(0)
        if isinstance(step, ChatFailed):
            raise step
        # The context grows by one mark per call, so tests can see it carried between turns.
        context += f"[{len(self.chat_calls)}]"
        if isinstance(step, ModelAnswer):
            return ChatStep(context, self.chat_usage, [], step)
        searches = [SearchCall(f"call-{n}", search) for n, search in enumerate(step)]
        return ChatStep(context, self.chat_usage, searches, None)

    CHAT_USAGE = AiUsage(
        model="claude-opus-5-5",
        input_tokens=5_000,
        output_tokens=500,
        web_searches=0,
        duration=timedelta(seconds=4),
    )

    def score_items(self, items: Sequence[UnscoredItem], stocks: Sequence[str]) -> ScoringResult:
        self.calls.append(list(items))
        self.tickers_given.append(list(stocks))
        if self.unavailable:
            raise ScoringUnavailable("scripted outage")
        if any(word in item.title for item in items for word in self.failing_titles):
            raise ScoringFailed("scripted failure", self.USAGE)
        return self.answer(items)

    def write_briefing_section(self, section: SectionRequest) -> SectionResult:
        self.sections.append(section)
        if section.folder_name in self.failing_folders:
            raise BriefingFailed("scripted refusal", self.SECTION_USAGE)
        return self.section_answer(section)

    SECTION_USAGE = AiUsage(
        model="claude-opus-5-5",
        input_tokens=20_000,
        output_tokens=1_500,
        web_searches=0,
        duration=timedelta(seconds=20),
    )

    @classmethod
    def one_point_per_item(cls, section: SectionRequest) -> SectionResult:
        points = [WrittenPoint(f"Point about {item.title}", [item.id]) for item in section.items]
        return SectionResult(points, cls.SECTION_USAGE)

    @classmethod
    def score_all(cls, items: Sequence[UnscoredItem]) -> ScoringResult:
        scores = [ItemScore(item.id, 3, f"Summary of {item.title}") for item in items]
        return ScoringResult(scores, cls.USAGE)


class FakeMailbox:
    """Holds the messages the test delivered; marking one handled takes it out."""

    def __init__(self) -> None:
        self.messages: list[MailMessage] = []
        self.handled: list[str] = []

    def unhandled(self) -> list[MailMessage]:
        return [message for message in self.messages if message.uid not in self.handled]

    def mark_handled(self, uids: Sequence[str]) -> None:
        self.handled.extend(uids)


def make_wiring(
    settings: Settings,
    clock: FakeClock,
    *,
    feed_fetcher: FakeFeedFetcher | None = None,
    language_model: FakeLanguageModel | None = None,
    article_extractor: FakeArticleExtractor | None = None,
    push_sender: FakePushSender | None = None,
    alerts_off: bool = False,
    mailbox: FakeMailbox | None = None,
    starter_folders: Sequence[StarterFolder] = (),
) -> Wiring:
    """The whole app over the settings' database file, with fakes for the outside world.

    A second call over the same file is the app after a restart. `alerts_off` builds it as if
    no VAPID key were configured.
    """
    database = SqliteDatabase(settings.database_path)
    database.migrate()
    return build_app(
        settings,
        database=database,
        feed_fetcher=feed_fetcher or FakeFeedFetcher(),
        language_model=language_model or FakeLanguageModel(),
        article_extractor=article_extractor or FakeArticleExtractor(),
        push_sender=None if alerts_off else push_sender or FakePushSender(),
        mailbox=mailbox,
        clock=clock,
        starter_folders=starter_folders,
        run_tick_loop=False,
    )
