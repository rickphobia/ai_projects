// The owner's stocks as the PWA sees them (api/stocks), and how the backend's JSON becomes them.

// A stock on the Watchlist, as a US ticker such as "NVDA" or a Bursa one such as "1155.KL".
export interface WatchedStock {
  ticker: string;
  // ISO 8601 with a time zone.
  addedAt: string;
}

export interface OwnerStocks {
  // Oldest first.
  watchlist: WatchedStock[];
}

export interface WatchedStockJson {
  ticker: string;
  added_at: string;
}

export interface OwnerStocksJson {
  watchlist: WatchedStockJson[];
}

export function watchedFromJson(body: WatchedStockJson): WatchedStock {
  return { ticker: body.ticker, addedAt: body.added_at };
}

export function stocksFromJson(body: OwnerStocksJson): OwnerStocks {
  return {
    watchlist: body.watchlist.map(watchedFromJson),
  };
}
