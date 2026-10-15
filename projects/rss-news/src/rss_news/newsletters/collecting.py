"""Newsletters: turning the messages in the newsletter mailbox into Items, one Source per sender."""

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from urllib.parse import quote

from rss_news.clock import Clock
from rss_news.items.inbox import BODY_LENGTH, ItemStore, NewItem
from rss_news.sources.feed_text import cut

logger = logging.getLogger(__name__)

NEWSLETTERS_FOLDER = "Newsletters"
_EXCERPT_LENGTH = 500


@dataclass(frozen=True)
class MailMessage:
    # The mailbox's own handle for the message, passed back to mark it handled.
    uid: str
    # The Message-ID header without its angle brackets; unique per issue.
    message_id: str
    sender_address: str
    # The display name in From, or the address when there is none.
    sender_name: str
    subject: str
    # The body as plain text. Never logged.
    text: str
    received_at: datetime


class MailboxError(Exception):
    """The mailbox couldn't be read or updated; says which step and what happened."""


class Mailbox(Protocol):
    def unhandled(self) -> list[MailMessage]:
        """Messages not yet marked handled, oldest first. Raises MailboxError."""
        ...

    def mark_handled(self, uids: Sequence[str]) -> None:
        """Raises MailboxError."""
        ...


class NewsletterSources(Protocol):
    def newsletter_source(self, *, folder_name: str, name: str, url: str) -> int:
        """The id of the Source with `url`, wherever the owner moved it; otherwise a new one in
        `folder_name`, which is created if missing."""
        ...


def sender_url(address: str) -> str:
    """A newsletter Source's URL: the sender's address, so each sender is one Source."""
    return f"mailto:{address.strip().lower()}"


def issue_url(message_id: str) -> str:
    """Opens the issue in Gmail; also unique per issue, so a message read twice is one Item."""
    return "https://mail.google.com/mail/u/0/#search/" + quote(f"rfc822msgid:{message_id}")


class Newsletters:
    def __init__(
        self, *, mailbox: Mailbox, sources: NewsletterSources, items: ItemStore, clock: Clock
    ) -> None:
        self._mailbox = mailbox
        self._sources = sources
        self._items = items
        self._clock = clock

    def collect(self) -> None:
        """Store each unhandled message as an Item of its sender's Source, then mark them
        handled. Marking comes last: a crash in between only reads the messages again, and
        their Items are already stored, so they are skipped."""
        messages = self._mailbox.unhandled()
        if not messages:
            return
        now = self._clock.now()
        stored = self._items.add_new([self._new_item(message, now) for message in messages])
        self._mailbox.mark_handled([message.uid for message in messages])
        logger.info("newsletters collected", extra={"messages": len(messages), "new_items": stored})

    def _new_item(self, message: MailMessage, now: datetime) -> NewItem:
        source_id = self._sources.newsletter_source(
            folder_name=NEWSLETTERS_FOLDER,
            name=message.sender_name,
            url=sender_url(message.sender_address),
        )
        url = issue_url(message.message_id)
        return NewItem(
            source_id=source_id,
            title=message.subject or "(no subject)",
            url=url,
            clean_url=url,
            excerpt=_preview(message.text),
            # The email is the whole issue; Reader view shows it as it came.
            body=_paragraphs(message.text),
            body_complete=True,
            # A future Date header can't put an issue on top of the Inbox for days.
            published_at=min(message.received_at, now),
        )


def _paragraphs(text: str) -> str:
    lines = (" ".join(line.split()) for line in text.splitlines())
    return cut("\n".join(line for line in lines if line), BODY_LENGTH)


def _preview(text: str) -> str:
    text = " ".join(text.split())
    if len(text) <= _EXCERPT_LENGTH:
        return text
    return text[: _EXCERPT_LENGTH - 1].rstrip() + "…"
