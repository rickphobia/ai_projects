"""Writing Briefings: choosing the Items, estimating the cost, one model call per Folder, and
reusing the Briefing already written today."""

import logging
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from typing import Literal
from zoneinfo import ZoneInfo

from rss_news.briefings.briefing import (
    ALL_SOURCES_24H,
    Briefing,
    BriefingFailed,
    BriefingItem,
    BriefingModel,
    BriefingPoint,
    BriefingScope,
    BriefingSection,
    BriefingStore,
    NothingToBrief,
    PickedScope,
    PointItem,
    SectionItem,
    SectionRequest,
    WindowScope,
    window_text,
)
from rss_news.briefings.fitting import (
    FULL_TEXT_ITEMS,
    cut_full_text,
    estimated_prompt_tokens,
    fit_lines,
    full_text_room,
    line_summary,
)
from rss_news.clock import Clock
from rss_news.items.reading import ArticleExtractor, ExtractionFailed
from rss_news.spending.ledger import AiUsage, Feature, SpendingLedger
from rss_news.spending.limit import SpendingLimit

logger = logging.getLogger(__name__)

# The estimate's guess at a section's answer, thinking included. The real usage is what the
# ledger records.
ESTIMATED_OUTPUT_TOKENS_PER_SECTION = 3_000


@dataclass(frozen=True)
class PlannedSection:
    folder_id: int
    folder_name: str
    items: list[BriefingItem]


@dataclass(frozen=True)
class BriefingPlan:
    """The Items a Briefing will be written from, grouped by Folder."""

    scope: BriefingScope
    sections: list[PlannedSection]

    @property
    def item_count(self) -> int:
        return sum(len(section.items) for section in self.sections)


@dataclass(frozen=True)
class BriefingProgress:
    """Sent while a Briefing is written. `step` is "reading" while the top articles are fetched
    and "writing" while the model writes the section."""

    step: Literal["reading", "writing"]
    # 1-based, of `sections`.
    section: int
    sections: int
    folder_name: str


class Briefings:
    def __init__(
        self,
        *,
        store: BriefingStore,
        model: BriefingModel,
        extractor: ArticleExtractor,
        ledger: SpendingLedger,
        limit: SpendingLimit,
        clock: Clock,
        timezone: ZoneInfo,
        model_name: str,
        token_budget: int,
        importance_cutoff: int,
    ) -> None:
        self._importance_cutoff = importance_cutoff
        self._store = store
        self._model = model
        self._extractor = extractor
        self._ledger = ledger
        self._limit = limit
        self._clock = clock
        self._timezone = timezone
        self._model_name = model_name
        self._token_budget = token_budget

    def latest(self) -> Briefing | None:
        return self._store.latest()

    def saved_today(self, scope: BriefingScope) -> Briefing | None:
        """Today's Briefing of this scope, so asking twice doesn't pay twice."""
        return self._store.latest_on(scope.key, self._today())

    def all_newest_first(self) -> list[Briefing]:
        return self._store.all_newest_first()

    def get(self, briefing_id: int) -> Briefing | None:
        return self._store.get(briefing_id)

    def plan(self, scope: BriefingScope) -> BriefingPlan:
        """The scope's Items grouped by Folder: every Item for 24 hours, only those at or above
        the Importance cut-off for longer windows, and the picked ones as they are. Raises
        NothingToBrief."""
        items = self._items_in(scope)
        if not items:
            raise NothingToBrief(_nothing_text(scope, self._cutoff_for(scope)))
        by_folder: dict[int, PlannedSection] = {}
        for item in items:
            section = by_folder.setdefault(
                item.folder_id, PlannedSection(item.folder_id, item.folder_name, [])
            )
            section.items.append(item)
        return BriefingPlan(scope, list(by_folder.values()))

    def _items_in(self, scope: BriefingScope) -> list[BriefingItem]:
        if isinstance(scope, PickedScope):
            return self._store.items_with_ids(scope.item_ids)
        return self._store.items_since(
            self._clock.now() - scope.window,
            folder_id=scope.folder_id,
            min_importance=self._cutoff_for(scope),
        )

    def _cutoff_for(self, scope: BriefingScope) -> int | None:
        """Longer windows keep to the more important Items, so they stay focused and cheap."""
        if isinstance(scope, WindowScope) and scope.window > ALL_SOURCES_24H.window:
            return self._importance_cutoff
        return None

    def estimated_cost(self, plan: BriefingPlan) -> Decimal:
        """Worked out from the Items and the configured prices; the model isn't called."""
        usage = AiUsage(
            model=self._model_name,
            input_tokens=sum(
                estimated_prompt_tokens(section.items, self._token_budget)
                for section in plan.sections
            ),
            output_tokens=ESTIMATED_OUTPUT_TOKENS_PER_SECTION * len(plan.sections),
            web_searches=0,
            duration=timedelta(),
        )
        return self._ledger.cost(usage)

    def write(self, plan: BriefingPlan) -> Iterator[BriefingProgress | Briefing]:
        """Progress for each section, then the saved Briefing. Raises SpendingStopped at once,
        before any call, when this month's limit is reached. A failed section raises
        BriefingFailed: nothing is saved, and the calls already made stay in the ledger."""
        # Checked here, not inside the generator, so the caller hears before streaming starts.
        self._limit.check_not_stopped()
        return self._write(plan)

    def _write(self, plan: BriefingPlan) -> Iterator[BriefingProgress | Briefing]:
        logger.info(
            "briefing started",
            extra={
                "scope": plan.scope.key,
                "items": plan.item_count,
                "sections": len(plan.sections),
            },
        )
        sections: list[BriefingSection] = []
        cost = Decimal(0)
        total = len(plan.sections)
        for number, planned in enumerate(plan.sections, start=1):
            yield BriefingProgress("reading", number, total, planned.folder_name)
            request, given = self._section_request(planned)
            yield BriefingProgress("writing", number, total, planned.folder_name)
            try:
                result = self._model.write_briefing_section(request)
            except BriefingFailed as error:
                if error.usage is not None:
                    self._ledger.record(Feature.BRIEFINGS, error.usage)
                logger.error(
                    "briefing failed",
                    extra={
                        "scope": plan.scope.key,
                        "folder": planned.folder_name,
                        "detail": str(error),
                    },
                )
                raise
            cost += self._ledger.record(Feature.BRIEFINGS, result.usage).cost_usd
            invented = sorted(
                {item_id for point in result.points for item_id in point.item_ids} - set(given)
            )
            if invented:
                logger.warning(
                    "briefing points named items they weren't given; links dropped",
                    extra={"folder": planned.folder_name, "item_ids": invented},
                )
            points = [
                BriefingPoint(
                    point.text,
                    [_point_item(given[item_id]) for item_id in point.item_ids if item_id in given],
                )
                for point in result.points
            ]
            sections.append(BriefingSection(planned.folder_id, planned.folder_name, points))
        now = self._clock.now()
        briefing = self._store.add(
            scope_key=plan.scope.key,
            created_at=now,
            local_day=self._today(),
            item_count=plan.item_count,
            cost_usd=cost,
            sections=sections,
        )
        logger.info(
            "briefing written",
            extra={"briefing_id": briefing.id, "scope": plan.scope.key, "cost_usd": str(cost)},
        )
        yield briefing

    def _section_request(
        self, planned: PlannedSection
    ) -> tuple[SectionRequest, dict[int, BriefingItem]]:
        """What the model is given for one Folder, and the Items in it by id."""
        fitted = fit_lines(planned.items, self._token_budget)
        if len(fitted.items) < len(planned.items):
            logger.info(
                "briefing section cut to fit",
                extra={
                    "folder": planned.folder_name,
                    "items": len(planned.items),
                    "kept": len(fitted.items),
                },
            )
        room = full_text_room(self._token_budget, fitted.tokens)
        full_texts: dict[int, str] = {}
        for item in fitted.items[:FULL_TEXT_ITEMS]:
            if room <= 0:
                break
            try:
                text = cut_full_text(self._extractor.extract(item.url).text, room)
            except ExtractionFailed as error:
                # The line still goes in; the model just doesn't get the article.
                logger.warning(
                    "briefing article unavailable",
                    extra={"item_id": item.id, "detail": str(error)},
                )
                continue
            full_texts[item.id] = text
            room -= len(text)
        request = SectionRequest(
            planned.folder_name,
            [
                SectionItem(
                    id=item.id,
                    title=item.title,
                    source_name=item.source_name,
                    importance=item.importance,
                    summary=line_summary(item),
                    full_text=full_texts.get(item.id),
                )
                for item in fitted.items
            ],
        )
        return request, {item.id: item for item in fitted.items}

    def _today(self) -> date:
        return self._clock.now().astimezone(self._timezone).date()


def _point_item(item: BriefingItem) -> PointItem:
    return PointItem(item.id, item.title, item.source_name)


def _nothing_text(scope: BriefingScope, cutoff: int | None) -> str:
    if isinstance(scope, PickedScope):
        return "None of the picked Items exist any more."
    where = "" if scope.folder_id is None else " in this Folder"
    text = f"No Items were published{where} in the last {window_text(scope.window)}"
    if cutoff is not None:
        text += f" with Importance {cutoff} or higher"
    return text + "."
