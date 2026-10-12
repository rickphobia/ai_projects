import pytest

from rss_news.stocks.tickers import InvalidTicker, ticker_feed_url, ticker_symbol


@pytest.mark.parametrize(
    ("typed", "symbol"),
    [
        ("NVDA", "NVDA"),
        ("aapl", "AAPL"),
        ("  msft ", "MSFT"),
        ("F", "F"),
        ("GOOGL", "GOOGL"),
        ("BRK-B", "BRK-B"),
        # Yahoo writes a US share class with a dash, so a dot is changed to one.
        ("brk.b", "BRK-B"),
        ("1155.KL", "1155.KL"),
        ("1155.kl", "1155.KL"),
        ("5235SS.KL", "5235SS.KL"),
        ("$TSLA", "TSLA"),
    ],
)
def test_us_and_bursa_tickers_are_accepted_in_one_form(typed: str, symbol: str) -> None:
    assert ticker_symbol(typed) == symbol


@pytest.mark.parametrize(
    "typed",
    ["", "   ", "TOOLONG", "NV DA", "1155", "115.KL", "MAYBANK.KL", "VOD.LSE", "BRK-BBB", "A1"],
)
def test_anything_else_is_refused(typed: str) -> None:
    with pytest.raises(InvalidTicker):
        ticker_symbol(typed)


def test_the_feed_is_yahoos_headlines_for_the_ticker() -> None:
    assert ticker_feed_url("1155.KL") == (
        "https://feeds.finance.yahoo.com/rss/2.0/headline?s=1155.KL&region=US&lang=en-US"
    )
