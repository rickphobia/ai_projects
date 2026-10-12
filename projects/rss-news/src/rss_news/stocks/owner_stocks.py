"""The owner's stocks: the Watchlist they edit, and one ticker-news Source per stock in the
Stocks Folder, added and removed as the Watchlist changes."""

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from rss_news.clock import Clock
from rss_news.stocks.tickers import ticker_feed_url, ticker_symbol

logger = logging.getLogger(__name__)

# Created at the end of the Folder list if the owner has none by this name.
STOCKS_FOLDER = "Stocks"


@dataclass(frozen=True)
class WatchedStock:
    ticker: str
    added_at: datetime


class AlreadyWatched(Exception):
    """The ticker is on the Watchlist already."""


class NotWatched(Exception):
    """The ticker isn't on the Watchlist."""


class StockStore(Protocol):
    def watchlist(self) -> list[WatchedStock]:
        """The Watchlist, oldest first."""
        ...

    def add_to_watchlist(self, ticker: str, at: datetime) -> WatchedStock:
        """Raises AlreadyWatched."""
        ...

    def remove_from_watchlist(self, ticker: str) -> None:
        """Raises NotWatched."""
        ...

    def ticker_sources(self) -> dict[str, int]:
        """The Source id kept for each ticker. A Source the owner deleted by hand is gone
        from here too."""
        ...

    def add_ticker_source(self, ticker: str, *, folder_name: str, name: str, url: str) -> int:
        """Add the ticker's Source to the named Folder, creating the Folder if needed, and
        return its id. A Source with the same URL already there is kept for the ticker."""
        ...

    def remove_ticker_source(self, ticker: str) -> None:
        """Delete the ticker's Source and its Items."""
        ...


class Stocks:
    def __init__(self, store: StockStore, clock: Clock) -> None:
        self._store = store
        self._clock = clock

    def watchlist(self) -> list[WatchedStock]:
        return self._store.watchlist()

    def tickers(self) -> list[str]:
        """Every Watchlist ticker, in alphabetical order."""
        return sorted(stock.ticker for stock in self._store.watchlist())

    def watch(self, typed: str) -> WatchedStock:
        """Add a ticker to the Watchlist and give it a news Source. Raises InvalidTicker or
        AlreadyWatched."""
        stock = self._store.add_to_watchlist(ticker_symbol(typed), self._clock.now())
        logger.info("stock watched", extra={"ticker": stock.ticker})
        self.keep_ticker_sources()
        return stock

    def unwatch(self, typed: str) -> None:
        """Take a ticker off the Watchlist, and its Source with it. Raises InvalidTicker or
        NotWatched."""
        ticker = ticker_symbol(typed)
        self._store.remove_from_watchlist(ticker)
        logger.info("stock unwatched", extra={"ticker": ticker})
        self.keep_ticker_sources()

    def keep_ticker_sources(self) -> None:
        """One ticker-news Source per Watchlist stock: add the missing ones and remove those
        of stocks no longer on it."""
        wanted = set(self.tickers())
        kept = self._store.ticker_sources()
        for ticker in sorted(wanted - kept.keys()):
            source_id = self._store.add_ticker_source(
                ticker,
                folder_name=STOCKS_FOLDER,
                name=f"{ticker} news",
                url=ticker_feed_url(ticker),
            )
            logger.info("ticker source added", extra={"ticker": ticker, "source_id": source_id})
        for ticker in sorted(kept.keys() - wanted):
            self._store.remove_ticker_source(ticker)
            logger.info(
                "ticker source removed", extra={"ticker": ticker, "source_id": kept[ticker]}
            )
