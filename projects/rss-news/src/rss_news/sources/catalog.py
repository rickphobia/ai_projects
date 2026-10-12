"""Folders and Sources: what they are, where they are kept, and loading the starter set."""

import logging
import re
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Folder:
    id: int
    name: str


@dataclass(frozen=True)
class Source:
    id: int
    folder_id: int
    name: str
    url: str
    # Caching headers from the last answer, sent back so an unchanged feed costs nothing.
    etag: str | None
    last_modified: str | None


@dataclass(frozen=True)
class SourceStatus:
    """A Source as the owner manages it: where it is and how its fetching goes."""

    id: int
    folder_id: int
    name: str
    url: str
    paused: bool
    last_success_at: datetime | None
    last_error_at: datetime | None
    last_error: str | None


class CatalogError(Exception):
    """A change to the Folders and Sources the owner asked for and can't have."""


class NotFound(CatalogError):
    pass


class AlreadyExists(CatalogError):
    pass


class FolderNotEmpty(CatalogError):
    pass


class NotAFeedUrl(CatalogError):
    pass


class InvalidSubreddit(CatalogError):
    pass


# Reddit's own rule for subreddit names.
_SUBREDDIT_NAME = re.compile(r"[A-Za-z0-9][A-Za-z0-9_]{1,20}")


def subreddit_name(typed: str) -> str:
    """The bare name from what the owner typed: `LocalLLaMA`, `r/LocalLLaMA` or `/r/LocalLLaMA`."""
    name = typed.strip().removeprefix("/").removeprefix("r/")
    if not _SUBREDDIT_NAME.fullmatch(name):
        raise InvalidSubreddit(f"{typed!r} isn't a subreddit name (letters, digits and _)")
    return name


def subreddit_feed_url(name: str) -> str:
    # The day's top posts rather than every new one: a busy subreddit would flood the Inbox.
    return f"https://www.reddit.com/r/{name}/top/.rss?t=day"


@dataclass(frozen=True)
class StarterSource:
    name: str
    url: str


@dataclass(frozen=True)
class StarterFolder:
    name: str
    sources: Sequence[StarterSource]


class FetchSchedule(Protocol):
    """The part of the store that fetching needs."""

    def due(self, now: datetime) -> list[Source]:
        """Unpaused Sources whose next fetch is at or before `now`, those never fetched first."""
        ...

    def record_success(
        self,
        source_id: int,
        *,
        at: datetime,
        next_fetch_at: datetime,
        etag: str | None,
        last_modified: str | None,
    ) -> None: ...

    def record_failure(
        self, source_id: int, *, at: datetime, next_fetch_at: datetime, error: str
    ) -> None: ...


class SourceStore(FetchSchedule, Protocol):
    def load_starter_once(self, folders: Sequence[StarterFolder]) -> bool:
        """Add `folders` and their Sources unless a starter set was ever loaded; True if now.

        Remembered for good, so Sources the owner later removes don't come back.
        """
        ...

    def folders(self) -> list[Folder]:
        """Every Folder, in the owner's order."""
        ...

    def sources(self) -> list[SourceStatus]:
        """Every Source, by Folder order then name."""
        ...

    def add_folder(self, name: str) -> Folder:
        """Add a Folder at the end. Raises AlreadyExists."""
        ...

    def rename_folder(self, folder_id: int, name: str) -> None:
        """Raises NotFound or AlreadyExists."""
        ...

    def delete_folder(self, folder_id: int) -> None:
        """Raises NotFound, or FolderNotEmpty while it still has Sources."""
        ...

    def add_source(self, folder_id: int, name: str, url: str) -> SourceStatus:
        """Raises NotFound for the Folder, or AlreadyExists for the URL."""
        ...

    def update_source(
        self, source_id: int, *, folder_id: int | None = None, paused: bool | None = None
    ) -> SourceStatus:
        """Move and/or pause a Source; None leaves that part alone. Raises NotFound."""
        ...

    def delete_source(self, source_id: int) -> None:
        """Remove a Source and its Items. Raises NotFound."""
        ...


def load_starter_sources(store: SourceStore, folders: Sequence[StarterFolder]) -> None:
    """Load the starter Folders and Sources on first run; do nothing on later runs."""
    if store.load_starter_once(folders):
        logger.info(
            "starter sources loaded",
            extra={
                "folders": len(folders),
                "sources": sum(len(folder.sources) for folder in folders),
            },
        )
