"""Ticker symbols: the US and Bursa Malaysia forms the app accepts, and each one's news feed."""

import re
from urllib.parse import quote

# 1 to 5 letters, with an optional share class (BRK-B), as Yahoo writes US tickers.
_US_TICKER = re.compile(r"[A-Z]{1,5}(-[A-Z]{1,2})?")
# Bursa's 4-digit stock code, with up to 2 letters or digits for stapled and other securities
# (5235SS), then Yahoo's .KL suffix.
_BURSA_TICKER = re.compile(r"[0-9]{4}[A-Z0-9]{0,2}\.KL")
LONGEST_TICKER = 12


class InvalidTicker(Exception):
    """What the owner typed isn't a US or Bursa `.KL` ticker."""


def ticker_symbol(typed: str) -> str:
    """The ticker in the one form the app keeps, from what the owner typed: `nvda`, `$NVDA`,
    `BRK.B` or `1155.kl`. Raises InvalidTicker."""
    symbol = typed.strip().removeprefix("$").upper()
    if _BURSA_TICKER.fullmatch(symbol):
        return symbol
    symbol = symbol.replace(".", "-")
    if _US_TICKER.fullmatch(symbol):
        return symbol
    raise InvalidTicker(
        f"{typed.strip()!r} isn't a ticker: use a US one such as NVDA or BRK-B, "
        "or a Bursa one such as 1155.KL"
    )


def ticker_feed_url(symbol: str) -> str:
    # region=US works for .KL tickers too; Bursa ones just get fewer headlines.
    return (
        f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={quote(symbol)}&region=US&lang=en-US"
    )
