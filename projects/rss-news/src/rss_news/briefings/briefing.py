"""What a Briefing is, what it covers, and the ports writing one goes through."""

from collections.abc import Iterable, Sequence
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


# The windows a Briefing can cover, by the name the API uses.
WINDOWS: dict[str, timedelta] = {
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
}


@dataclass(frozen=True)
class WindowScope:
    """All Sources, or one Folder, over a window ending now."""

    window: timedelta
    # None for all Sources.
    folder_id: int | None = None

    @property
    def key(self) -> str:
        """Names the scope in the database: asking again for one saved today reuses it."""
        hours = self.window // timedelta(hours=1)
        if self.folder_id is None:
            return f"all-{hours}h"
        return f"folder-{self.folder_id}-{hours}h"


@dataclass(frozen=True)
class PickedScope:
    """Items the owner ticked by hand, whenever they were published."""

    item_ids: frozenset[int]

    @property
    def key(self) -> str:
        return "picked-" + ",".join(str(item_id) for item_id in sorted(self.item_ids))


type BriefingScope = WindowScope | PickedScope

ALL_SOURCES_24H = WindowScope(window=WINDOWS["24h"])


def window_text(window: timedelta) -> str:
    hours = window // timedelta(hours=1)
    return f"{hours} hours" if hours < 48 else f"{hours // 24} days"


def scope_title(scope_key: str, sections: Sequence["BriefingSection"]) -> str:
    """What the owner reads for a saved Briefing's scope, such as "AI, last 7 days"."""
    kind, _, rest = scope_key.partition("-")
    if kind == "picked":
        return f"{len(rest.split(','))} picked Items"
    hours = int(rest.rsplit("-", 1)[-1].removesuffix("h"))
    window = f"last {window_text(timedelta(hours=hours))}"
    if kind == "folder":
        # A Folder Briefing has one section, whose name was copied in when it was written.
        name = sections[0].folder_name if sections else "One Folder"
        return f"{name}, {window}"
    return f"All Sources, {window}"


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

    @property
    def title(self) -> str:
        return scope_title(self.scope_key, self.sections)


class BriefingStore(Protocol):
    def items_since(
        self, since: datetime, *, folder_id: int | None, min_importance: int | None
    ) -> list[BriefingItem]:
        """Items published at or after `since`, in the Folders' order and newest first in
        each. Only one Folder's when `folder_id` is set; only scored Items at or above
        `min_importance` when that is set."""
        ...

    def items_with_ids(self, item_ids: Iterable[int]) -> list[BriefingItem]:
        """Those of these Items that still exist, ordered as items_since orders them."""
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

    def all_newest_first(self) -> list[Briefing]: ...

    def get(self, briefing_id: int) -> Briefing | None: ...

    def latest_on(self, scope_key: str, local_day: date) -> Briefing | None:
        """The newest Briefing of this scope written on this day in the owner's time zone."""
        ...
