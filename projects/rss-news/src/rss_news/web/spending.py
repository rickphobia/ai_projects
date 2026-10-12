"""This month's AI spending over the JSON API, for the Settings screen."""

from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Request

from rss_news.spending.limit import SpendingLimit

spending_router = APIRouter(prefix="/api/spending")
_CENT_FRACTION = Decimal("0.01")


@spending_router.get("")
def spending_summary(request: Request) -> dict[str, Any]:
    """Month-to-date cost in USD, in total and per feature, against the monthly limit, with
    the status: `ok`, `warning` from 80%, or `stopped` from 100%."""
    limit: SpendingLimit = request.app.state.spending
    summary = limit.summary()
    return {
        "month_start": summary.month_start.isoformat(),
        "total_usd": _cents(summary.total_usd),
        "limit_usd": _cents(summary.limit_usd),
        "status": summary.status.value,
        "by_feature": {feature.value: _cents(cost) for feature, cost in summary.by_feature.items()},
    }


def _cents(amount: Decimal) -> str:
    return str(amount.quantize(_CENT_FRACTION))
