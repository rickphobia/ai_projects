"""Fitting one Folder's Items into a section call's token budget."""

from datetime import UTC, datetime, timedelta

from rss_news.briefings.briefing import BriefingItem
from rss_news.briefings.fitting import (
    FULL_TEXT_CHARACTERS,
    INSTRUCTION_TOKENS,
    cut_full_text,
    estimated_prompt_tokens,
    fit_lines,
    full_text_room,
    line_summary,
    most_important_first,
)

NOON = datetime(2026, 10, 12, 12, tzinfo=UTC)


def item(item_id: int, importance: int | None, *, hours_ago: int = 0) -> BriefingItem:
    return BriefingItem(
        id=item_id,
        title=f"Story {item_id}",
        url=f"https://news.example/{item_id}",
        source_name="Example",
        folder_id=1,
        folder_name="AI",
        published_at=NOON - timedelta(hours=hours_ago),
        importance=importance,
        summary=None if importance is None else f"Summary {item_id}",
        excerpt="x" * 1000,
    )


def test_most_important_first_then_newest_and_unscored_last() -> None:
    ordered = most_important_first(
        [item(1, 3, hours_ago=2), item(2, None), item(3, 5), item(4, 3, hours_ago=1)]
    )

    assert [found.id for found in ordered] == [3, 4, 1, 2]


def test_an_unscored_item_stands_in_with_the_start_of_its_excerpt() -> None:
    assert line_summary(item(1, 4)) == "Summary 1"
    assert line_summary(item(2, None)) == "x" * 300


def test_lines_stop_at_the_budget_keeping_the_most_important() -> None:
    items = [item(n, 1 + n % 5, hours_ago=n) for n in range(100)]

    fitted = fit_lines(items, INSTRUCTION_TOKENS + 200)

    assert 1 < len(fitted.items) < 100
    assert fitted.tokens <= INSTRUCTION_TOKENS + 200
    assert all(found.importance == 5 for found in fitted.items)


def test_one_item_always_goes_in_even_over_the_budget() -> None:
    assert len(fit_lines([item(1, 3)], 1).items) == 1


def test_full_text_gets_what_the_lines_leave_unless_too_little() -> None:
    assert full_text_room(10_000, 4_000) == 18_000
    assert full_text_room(10_000, 9_900) == 0


def test_an_article_is_cut_to_the_room_and_the_per_article_cap() -> None:
    article = "y" * 50_000

    assert len(cut_full_text(article, 1_000)) == 1_000
    assert len(cut_full_text(article, 100_000)) == FULL_TEXT_CHARACTERS


def test_the_estimate_assumes_full_length_articles_within_the_budget() -> None:
    few = [item(1, 5), item(2, 4)]

    assert estimated_prompt_tokens(few, 40_000) > fit_lines(few, 40_000).tokens
    assert estimated_prompt_tokens([item(n, 3) for n in range(500)], 40_000) <= 40_000
