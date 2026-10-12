"""Dictionary look-ups over the JSON API."""

from decimal import Decimal
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from rss_news.dictionary.lookup import LONGEST_CONTEXT, LONGEST_TERM, Dictionary, DictionaryFailed
from rss_news.spending.limit import SpendingStopped

dictionary_router = APIRouter(prefix="/api/dictionary")
# A look-up costs a fraction of a cent, so the owner sees it to the hundredth of a cent.
_COST_FRACTION = Decimal("0.0001")


class LookUp(BaseModel):
    term: str = Field(min_length=1, max_length=LONGEST_TERM)
    context: str = Field(default="", max_length=LONGEST_CONTEXT)


@dictionary_router.post("")
def look_up(request: Request, body: LookUp) -> dict[str, Any]:
    """A short definition of `term` as it is used in `context`. 429 when this month's
    spending limit is reached, 502 when the model gives no definition."""
    if not body.term.strip():
        raise HTTPException(status_code=422, detail="Select a word first.")
    dictionary: Dictionary = request.app.state.dictionary
    try:
        found = dictionary.define(body.term, body.context)
    except SpendingStopped as error:
        raise HTTPException(status_code=429, detail=str(error)) from None
    except DictionaryFailed as error:
        raise HTTPException(
            status_code=502, detail=f"The Dictionary couldn't define it: {error}."
        ) from None
    return {
        "term": found.term,
        "definition": found.definition,
        "cost_usd": str(found.cost_usd.quantize(_COST_FRACTION)),
    }
