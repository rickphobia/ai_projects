"""Folders and Sources: what they are, where they are kept, and loading the starter set."""

import logging
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
class StarterSource:
    name: str
    url: str


@dataclass(frozen=True)
class StarterFolder:
    name: str
    sources: Sequence[StarterSource]


class SourceStore(Protocol):
    def load_starter_once(self, folders: Sequence[StarterFolder]) -> bool:
        """Add `folders` and their Sources unless a starter set was ever loaded; True if now.

        Remembered for good, so Sources the owner later removes don't come back.
        """
        ...

    def folders(self) -> list[Folder]:
        """Every Folder, in the owner's order."""
        ...

    def due(self, now: datetime) -> list[Source]:
        """Sources whose next fetch is at or before `now`, those never fetched first."""
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
