"""What a Briefing is, what it covers, and the ports writing one goes through."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Protocol

from rss_news.spending.ledger import AiUsage


class NothingToBrief(Exception):
    """No Item falls in the Briefing's scope, so there is nothing to write about."""


class BriefingFailed(Exception):
    """Writing a section failed, so the whole Briefing did. `usage` is set when the model
    answered, so the call still cost money."""

    def __init__(self, message: str, usage: AiUsage | None = None) -> None:
        super().__init__(message)
        self.usage = usage


@dataclass(frozen=True)
class BriefingScope:
    """What a Briefing covers: all Sources over a window ending now."""

    window: timedelta

    @property
    def key(self) -> str:
        """Names the scope in the database: asking again for one saved today reuses it."""
        return f"all-{self.window // timedelta(hours=1)}h"


ALL_SOURCES_24H = BriefingScope(window=timedelta(hours=24))


@dataclass(frozen=True)
class BriefingItem:
    """An Item as a Briefing reads it."""

    id: int
    title: str
    url: str
    source_name: str
    folder_id: int
    folder_name: str
    published_at: datetime
    # Both None until the Item is scored.
    importance: int | None
    summary: str | None
    excerpt: str


@dataclass(frozen=True)
class SectionItem:
    """One Item as the model is given it."""

    id: int
    title: str
    source_name: str
    importance: int | None
    # The one-line summary, or the start of the excerpt while the Item is unscored.
    summary: str
    # The article from the original page, cut to fit; None for all but the top Items.
    full_text: str | None


@dataclass(frozen=True)
class SectionRequest:
    folder_name: str
    items: list[SectionItem]


@dataclass(frozen=True)
class WrittenPoint:
    text: str
    # The Items the point came from, as the model named them.
    item_ids: list[int]


@dataclass(frozen=True)
class SectionResult:
    points: list[WrittenPoint]
    usage: AiUsage


class BriefingModel(Protocol):
    def write_briefing_section(self, section: SectionRequest) -> SectionResult:
        """Write one Folder's points in one call. Raises BriefingFailed."""
        ...


@dataclass(frozen=True)
class PointItem:
    """An Item a point links to, kept with the Briefing so the link reads well even after the
    Item itself is deleted."""

    id: int
    title: str
    source_name: str


@dataclass(frozen=True)
class BriefingPoint:
    text: str
    items: list[PointItem]


@dataclass(frozen=True)
class BriefingSection:
    folder_id: int
    folder_name: str
    points: list[BriefingPoint]


@dataclass(frozen=True)
class Briefing:
    id: int
    scope_key: str
    created_at: datetime
    # How many Items it was written from.
    item_count: int
    # What its AI calls cost.
    cost_usd: Decimal
    sections: list[BriefingSection]


class BriefingStore(Protocol):
    def items_since(self, since: datetime) -> list[BriefingItem]:
        """Every Item published at or after `since`, in the Folders' order."""
        ...

    def add(
        self,
        *,
        scope_key: str,
        created_at: datetime,
        local_day: date,
        item_count: int,
        cost_usd: Decimal,
        sections: Sequence[BriefingSection],
    ) -> Briefing: ...

    def latest(self) -> Briefing | None: ...

    def latest_on(self, scope_key: str, local_day: date) -> Briefing | None:
        """The newest Briefing of this scope written on this day in the owner's time zone."""
        ...
