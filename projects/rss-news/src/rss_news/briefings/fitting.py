"""Fitting one Folder's Items into a section call's token budget.

Every Item gets a line with its one-line summary, most important first, until the budget is
used. What is left goes to the full text of the top Items, each cut to fit.
"""

from collections.abc import Sequence
from dataclasses import dataclass

from rss_news.briefings.briefing import BriefingItem
from rss_news.briefings.instructions import SECTION_INSTRUCTIONS

# A rough upper bound for how many tokens text becomes: English is nearer 4 characters per
# token, so 3 leaves room for Malay and other scripts without wasting much of the budget.
CHARACTERS_PER_TOKEN = 3
# The instructions, the answer format and the request around the Items.
INSTRUCTION_TOKENS = len(SECTION_INSTRUCTIONS) // CHARACTERS_PER_TOKEN + 300
# The top Items whose full text is fetched, and the most of each article given.
FULL_TEXT_ITEMS = 5
FULL_TEXT_CHARACTERS = 12_000
# Less room than this isn't worth fetching an article for.
_MIN_FULL_TEXT_TOKENS = 200
# The start of an unscored Item's excerpt that stands in for its summary.
_UNSCORED_EXCERPT_CHARACTERS = 300


@dataclass(frozen=True)
class FittedLines:
    # The Items that got a line, most important first.
    items: list[BriefingItem]
    # The tokens the instructions and those lines take; the rest of the budget is for full text.
    tokens: int


def most_important_first(items: Sequence[BriefingItem]) -> list[BriefingItem]:
    """Highest Importance first (unscored last), newest first within one."""
    return sorted(
        items,
        key=lambda item: (item.importance or 0, item.published_at, item.id),
        reverse=True,
    )


def line_summary(item: BriefingItem) -> str:
    if item.summary is not None:
        return item.summary
    return item.excerpt[:_UNSCORED_EXCERPT_CHARACTERS]


def fit_lines(items: Sequence[BriefingItem], budget: int) -> FittedLines:
    """The most important Items whose lines fit, at least one."""
    kept: list[BriefingItem] = []
    tokens = INSTRUCTION_TOKENS
    for item in most_important_first(items):
        item_tokens = _line_tokens(item)
        if kept and tokens + item_tokens > budget:
            break
        kept.append(item)
        tokens += item_tokens
    return FittedLines(kept, tokens)


def full_text_room(budget: int, used: int) -> int:
    """Characters of full text that fit beside the lines; 0 when too few to be worth it."""
    tokens = budget - used
    return tokens * CHARACTERS_PER_TOKEN if tokens >= _MIN_FULL_TEXT_TOKENS else 0


def cut_full_text(text: str, room: int) -> str:
    return text[: min(room, FULL_TEXT_CHARACTERS)]


def estimated_prompt_tokens(items: Sequence[BriefingItem], budget: int) -> int:
    """A section's prompt as if every top Item's full text were as long as allowed: the
    articles aren't fetched for an estimate."""
    fitted = fit_lines(items, budget)
    room = full_text_room(budget, fitted.tokens)
    full_text = min(room, min(len(fitted.items), FULL_TEXT_ITEMS) * FULL_TEXT_CHARACTERS)
    return fitted.tokens + full_text // CHARACTERS_PER_TOKEN


def _line_tokens(item: BriefingItem) -> int:
    characters = len(item.title) + len(line_summary(item)) + len(item.source_name)
    characters += 60  # the id, the Importance and the JSON around each Item
    return characters // CHARACTERS_PER_TOKEN + 1
