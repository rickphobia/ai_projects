"""SourceFetching when the store itself breaks: one Source's trouble never stops the rest."""

from collections.abc import Sequence
from datetime import datetime, timedelta

from rss_news.items.inbox import InboxItem, InboxPosition, NewItem
from rss_news.sources.catalog import Folder, Source, StarterFolder
from rss_news.sources.fetching import FetchFailed, SourceFetching
from tests.support import FakeClock, FakeFeedFetcher


def source(source_id: int) -> Source:
    return Source(source_id, 1, f"Source {source_id}", f"https://s{source_id}/rss", None, None)


class BrokenForFirstSource:
    """Every write about Source 1 fails, as a locked or full database would."""

    def __init__(self) -> None:
        self.failures_recorded: list[int] = []

    def load_starter_once(self, folders: Sequence[StarterFolder]) -> bool:
        return False

    def folders(self) -> list[Folder]:
        return []

    def due(self, now: datetime) -> list[Source]:
        return [source(1), source(2)]

    def record_success(self, source_id: int, **_: object) -> None:
        raise AssertionError("no Source succeeds in this test")

    def record_failure(
        self, source_id: int, *, at: datetime, next_fetch_at: datetime, error: str
    ) -> None:
        if source_id == 1:
            raise OSError("database is locked")
        self.failures_recorded.append(source_id)


class NoItems:
    def add_new(self, items: Sequence[NewItem]) -> int:
        return 0

    def newest_first(
        self, *, folder_id: int | None, after: InboxPosition | None, limit: int
    ) -> list[InboxItem]:
        return []


def test_a_store_error_for_one_source_does_not_stop_the_next() -> None:
    store = BrokenForFirstSource()
    fetcher = FakeFeedFetcher()
    fetcher.answers = {
        "https://s1/rss": FetchFailed("connect", "refused"),
        "https://s2/rss": FetchFailed("connect", "refused"),
    }
    fetching = SourceFetching(
        sources=store,
        items=NoItems(),
        fetcher=fetcher,
        clock=FakeClock(),
        interval=timedelta(minutes=15),
    )

    fetching.fetch_due()

    assert [request.url for request in fetcher.requests] == ["https://s1/rss", "https://s2/rss"]
    assert store.failures_recorded == [2]
