"""The owner's stocks over the JSON API: Holdings to read, and the Watchlist to list, add to and
remove from."""

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from rss_news.stocks.owner_stocks import AlreadyWatched, NotWatched, Stocks, WatchedStock
from rss_news.stocks.tickers import LONGEST_TICKER, InvalidTicker

stocks_router = APIRouter(prefix="/api/stocks")


class WatchBody(BaseModel):
    ticker: str = Field(min_length=1, max_length=LONGEST_TICKER)


def stocks_of(request: Request) -> Stocks:
    stocks: Stocks = request.app.state.stocks
    return stocks


def watched_json(stock: WatchedStock) -> dict[str, Any]:
    return {"ticker": stock.ticker, "added_at": stock.added_at.isoformat()}


@stocks_router.get("")
def list_stocks(request: Request) -> dict[str, Any]:
    """The Holdings (read from IBKR, not edited here) and the Watchlist, oldest first."""
    stocks = stocks_of(request)
    return {
        "holdings": [{"ticker": ticker} for ticker in stocks.holdings()],
        "watchlist": [watched_json(stock) for stock in stocks.watchlist()],
    }


@stocks_router.post("/watchlist", status_code=201)
def watch(request: Request, body: WatchBody) -> dict[str, Any]:
    try:
        return watched_json(stocks_of(request).watch(body.ticker))
    except InvalidTicker as error:
        raise HTTPException(status_code=422, detail=str(error)) from None
    except AlreadyWatched as error:
        raise HTTPException(status_code=409, detail=str(error)) from None


@stocks_router.delete("/watchlist/{ticker}", status_code=204)
def unwatch(request: Request, ticker: str) -> None:
    try:
        stocks_of(request).unwatch(ticker)
    except (InvalidTicker, NotWatched) as error:
        raise HTTPException(status_code=404, detail=str(error)) from None
