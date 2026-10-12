"""Chats: answering the owner's questions from their Items, one model call at a time, running
the `search_items` searches the model asks for in between."""

import logging
import re
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from rss_news.chat.conversation import (
    AnswerItem,
    Chat,
    ChatFailed,
    ChatInput,
    ChatMessage,
    ChatModel,
    ChatStep,
    ChatStore,
    ChatSummary,
    ItemSearch,
    ModelAnswer,
    NoSuchChat,
    OwnerQuestion,
    SearchResult,
    SearchResults,
)
from rss_news.clock import Clock
from rss_news.scoring.instructions import MAX_IMPORTANCE, MIN_IMPORTANCE
from rss_news.spending.ledger import Feature, SpendingLedger
from rss_news.spending.limit import SpendingLimit

logger = logging.getLogger(__name__)

DEFAULT_WINDOW = timedelta(hours=24)
# Items are deleted after 90 days, so looking further back finds nothing anyway.
LONGEST_WINDOW = timedelta(days=90)
# The most Items one search shows the model; the count still says how many matched.
ITEMS_PER_SEARCH = 40
# Model calls that may search before the model must answer, so a question can't loop.
SEARCHING_CALLS = 4
# Web searches one question may use, across all its model calls.
WEB_SEARCHES_PER_QUESTION = 5
# Words that mean the owner asked for the web, not just their Items.
_ASKS_FOR_WEB = re.compile(r"\b(web|internet|online|google)\b", re.IGNORECASE)
# Put before an answer's intro when the model searched the web for it.
WEB_SEARCH_FLAG = "Searched the web."


@dataclass(frozen=True)
class ChatSearched:
    """Sent while a turn runs, after each search the model asked for."""

    window: str
    count: int


class Chats:
    def __init__(
        self,
        *,
        store: ChatStore,
        model: ChatModel,
        ledger: SpendingLedger,
        limit: SpendingLimit,
        clock: Clock,
        timezone: ZoneInfo,
    ) -> None:
        self._store = store
        self._model = model
        self._ledger = ledger
        self._limit = limit
        self._clock = clock
        self._timezone = timezone

    def create(self) -> ChatSummary:
        return self._store.create(created_at=self._clock.now())

    def all_newest_first(self) -> list[ChatSummary]:
        return self._store.all_newest_first()

    def get(self, chat_id: int) -> Chat | None:
        return self._store.get(chat_id)

    def ask(self, chat_id: int, question: str) -> Iterator[ChatSearched | ChatMessage]:
        """A ChatSearched for each search, then the saved answer. Raises NoSuchChat or
        SpendingStopped at once, before any call. A failed call raises ChatFailed: nothing of
        the turn is saved, and the calls already made stay in the ledger."""
        chat = self._store.get(chat_id)
        if chat is None:
            raise NoSuchChat(f"Chat {chat_id} doesn't exist.")
        # Checked here, not inside the generator, so the caller hears before streaming starts.
        self._limit.check_not_stopped()
        return self._ask(chat, question)

    def _ask(self, chat: Chat, question: str) -> Iterator[ChatSearched | ChatMessage]:
        chat_id = chat.summary.id
        logger.info("chat question", extra={"chat_id": chat_id, "turn": len(chat.messages) // 2})
        cost = Decimal(0)
        web_offered = asks_for_web(question)
        web_searches = 0
        given: ChatInput = OwnerQuestion(
            question,
            self._clock.now().astimezone(self._timezone),
            [name for _, name in self._store.folders()],
            WEB_SEARCHES_PER_QUESTION if web_offered else 0,
        )
        context = chat.context
        answer: ModelAnswer | None = None
        for searching_call in range(SEARCHING_CALLS + 1):
            step = self._call(chat_id, context, given)
            cost += self._ledger.record(Feature.CHAT, step.usage).cost_usd
            context = step.context
            if step.usage.web_searches and not web_offered:
                logger.warning(
                    "chat searched the web without being offered it",
                    extra={"chat_id": chat_id, "web_searches": step.usage.web_searches},
                )
            web_searches += step.usage.web_searches
            if step.answer is not None:
                answer = step.answer
                break
            results = []
            for call in step.searches:
                result = self.search(call.search)
                if result.error is None:
                    yield ChatSearched(result.window, result.count)
                results.append((call.call_id, result))
            # Nothing in the Items: the web may have it.
            if all(result.error is None and result.count == 0 for _, result in results):
                web_offered = True
            web_left = max(WEB_SEARCHES_PER_QUESTION - web_searches, 0) if web_offered else 0
            given = SearchResults(
                results, last=searching_call + 1 == SEARCHING_CALLS, web_searches_left=web_left
            )
        if answer is None:
            logger.error("chat failed", extra={"chat_id": chat_id, "detail": "no answer"})
            raise ChatFailed("the model kept searching instead of answering")
        checked = self._checked(answer)
        if web_searches:
            checked = _CheckedAnswer(f"{WEB_SEARCH_FLAG} {checked.intro}", checked.items)
        saved = self._store.add_turn(
            chat_id,
            question=question,
            answer_intro=checked.intro,
            answer_items=checked.items,
            context=context,
            cost_usd=cost,
            at=self._clock.now(),
        )
        logger.info(
            "chat answered",
            extra={
                "chat_id": chat_id,
                "items": len(saved.items),
                "web_searches": web_searches,
                "cost_usd": str(cost),
            },
        )
        yield saved

    def _call(self, chat_id: int, context: str, given: ChatInput) -> ChatStep:
        try:
            return self._model.continue_chat(context, given)
        except ChatFailed as error:
            if error.usage is not None:
                self._ledger.record(Feature.CHAT, error.usage)
            logger.error("chat failed", extra={"chat_id": chat_id, "detail": str(error)})
            raise

    def search(self, search: ItemSearch) -> SearchResult:
        """Run one `search_items` call: the last 24 hours unless `since` says otherwise, at
        most 90 days back. A Folder or date that can't be used gives an error for the model."""
        now = self._clock.now()
        folder_id = None
        if search.folder:
            folders = {name.casefold(): folder for folder, name in self._store.folders()}
            folder_id = folders.get(search.folder.strip().casefold())
            if folder_id is None:
                return SearchResult.failed(f"There is no Folder {search.folder!r}.")
        importance = search.min_importance
        if importance is not None and not MIN_IMPORTANCE <= importance <= MAX_IMPORTANCE:
            return SearchResult.failed(
                f"min_importance must be from {MIN_IMPORTANCE} to {MAX_IMPORTANCE}."
            )
        if search.since:
            try:
                since = self._parse_since(search.since)
            except ValueError:
                return SearchResult.failed(
                    f"since {search.since!r} isn't an ISO 8601 date or time."
                )
            if since > now:
                return SearchResult.failed("since is in the future.")
            since = max(since, now - LONGEST_WINDOW)
            window = f"since {since.astimezone(self._timezone):%Y-%m-%d %H:%M}"
        else:
            since = now - DEFAULT_WINDOW
            window = "the last 24 hours"
        count, items = self._store.find_items(
            since=since,
            folder_id=folder_id,
            keyword=search.keyword.strip() if search.keyword else None,
            min_importance=search.min_importance,
            limit=ITEMS_PER_SEARCH,
        )
        logger.info("chat search", extra={"window": window, "count": count})
        return SearchResult(window, count, items)

    def _parse_since(self, text: str) -> datetime:
        """A date means its midnight; a time without an offset is the owner's local time."""
        text = text.strip()
        try:
            moment = datetime.combine(date.fromisoformat(text), time())
        except ValueError:
            moment = datetime.fromisoformat(text)
        if moment.utcoffset() is None:
            moment = moment.replace(tzinfo=self._timezone)
        return moment

    def _checked(self, answer: ModelAnswer) -> "_CheckedAnswer":
        """The answer with only real Items, each once, their titles and Sources copied in."""
        wanted = [entry.item_id for entry in answer.entries]
        found = self._store.items_with_ids(wanted)
        invented = sorted(set(wanted) - set(found))
        if invented:
            logger.warning(
                "chat answer named items that don't exist; dropped", extra={"item_ids": invented}
            )
        items: list[AnswerItem] = []
        listed: set[int] = set()
        for entry in answer.entries:
            item = found.get(entry.item_id)
            if item is None or item.id in listed:
                continue
            listed.add(item.id)
            items.append(AnswerItem(item.id, item.title, item.source_name, entry.summary))
        return _CheckedAnswer(answer.intro, items)


def asks_for_web(question: str) -> bool:
    return _ASKS_FOR_WEB.search(question) is not None


@dataclass(frozen=True)
class _CheckedAnswer:
    intro: str
    items: list[AnswerItem]
