"""The owner's changes to Folders and Sources, checking a new feed URL before it is added."""

import logging
from urllib.parse import urlsplit

from rss_news.sources.catalog import (
    Folder,
    NotAFeedUrl,
    SourceStatus,
    SourceStore,
    subreddit_feed_url,
    subreddit_name,
)
from rss_news.sources.feed_parsing import NotAFeed, parse_feed
from rss_news.sources.fetching import FeedFetcher, FeedRequest, Fetched, FetchFailed

logger = logging.getLogger(__name__)


class SourceManagement:
    def __init__(self, *, sources: SourceStore, fetcher: FeedFetcher) -> None:
        self._sources = sources
        self._fetcher = fetcher

    def folders(self) -> list[Folder]:
        return self._sources.folders()

    def sources(self) -> list[SourceStatus]:
        return self._sources.sources()

    def add_folder(self, name: str) -> Folder:
        folder = self._sources.add_folder(name)
        logger.info("folder added", extra={"folder_id": folder.id})
        return folder

    def rename_folder(self, folder_id: int, name: str) -> None:
        self._sources.rename_folder(folder_id, name)
        logger.info("folder renamed", extra={"folder_id": folder_id})

    def delete_folder(self, folder_id: int) -> None:
        self._sources.delete_folder(folder_id)
        logger.info("folder deleted", extra={"folder_id": folder_id})

    def add_feed(self, folder_id: int, url: str, name: str | None) -> SourceStatus:
        """Fetch `url` once and add it only if it answers with a feed. Raises NotAFeedUrl."""
        self._check_feed(url)
        source = self._sources.add_source(folder_id, name or urlsplit(url).hostname or url, url)
        logger.info("source added", extra={"source_id": source.id, "source": source.name})
        return source

    def add_subreddit(self, folder_id: int, typed_name: str) -> SourceStatus:
        # Not fetched first: Reddit often answers 429 to a lone request, which would refuse a
        # good name. A misspelt one shows up as the Source's last error instead.
        name = subreddit_name(typed_name)
        source = self._sources.add_source(folder_id, f"r/{name}", subreddit_feed_url(name))
        logger.info("source added", extra={"source_id": source.id, "source": source.name})
        return source

    def update_source(
        self, source_id: int, *, folder_id: int | None, paused: bool | None
    ) -> SourceStatus:
        source = self._sources.update_source(source_id, folder_id=folder_id, paused=paused)
        logger.info(
            "source updated",
            extra={"source_id": source_id, "folder_id": source.folder_id, "paused": source.paused},
        )
        return source

    def delete_source(self, source_id: int) -> None:
        self._sources.delete_source(source_id)
        logger.info("source deleted", extra={"source_id": source_id})

    def _check_feed(self, url: str) -> None:
        if urlsplit(url).scheme not in ("http", "https"):
            raise NotAFeedUrl(f"{url!r} isn't an http or https URL")
        result = self._fetcher.fetch(FeedRequest(url, etag=None, last_modified=None))
        match result:
            case FetchFailed(step=step, detail=detail):
                raise NotAFeedUrl(f"couldn't fetch {url} ({step}: {detail})")
            case Fetched(body=body, content_type=content_type):
                try:
                    parse_feed(body, content_type=content_type)
                except NotAFeed as error:
                    raise NotAFeedUrl(f"{url} isn't an RSS or Atom feed: {error}") from None
            case _:
                # Not modified can't come back without caching headers; nothing to check.
                pass
