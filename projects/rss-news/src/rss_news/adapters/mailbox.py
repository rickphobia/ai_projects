"""The newsletter Gmail inbox over IMAP: unread messages are new; handled ones are marked read."""

import imaplib
import logging
import re
import time
from collections.abc import Callable, Sequence
from datetime import UTC, datetime
from email import message_from_bytes, policy
from email.message import EmailMessage
from email.utils import parseaddr, parsedate_to_datetime
from html.parser import HTMLParser
from typing import cast

from rss_news.newsletters.collecting import MailboxError, MailMessage

logger = logging.getLogger(__name__)

# Messages read per tick; the rest wait for the next one, so a backlog can't stall the tick.
_BATCH = 50


class ImapMailbox:
    def __init__(
        self,
        *,
        host: str,
        address: str,
        app_password: str,
        timeout_seconds: float,
        connect: Callable[[str, float], imaplib.IMAP4] | None = None,
    ) -> None:
        self._host = host
        self._address = address
        self._app_password = app_password
        self._timeout = timeout_seconds
        self._connect = connect or (lambda host, timeout: imaplib.IMAP4_SSL(host, timeout=timeout))

    def unhandled(self) -> list[MailMessage]:
        started = time.monotonic()
        with self._session("read") as imap:
            found = cast(bytes, _ok(imap.uid("SEARCH", "UNSEEN"), "search")[0])
            messages = []
            for uid in found.decode().split()[:_BATCH]:
                # PEEK leaves the message unread until it is stored as an Item.
                fetched = _ok(imap.uid("FETCH", uid, "(BODY.PEEK[])"), "fetch")
                raw = next(part[1] for part in fetched if isinstance(part, tuple))
                messages.append(parse_message(uid, cast(bytes, raw)))
        logger.info(
            "mailbox read",
            extra={
                "port": "mailbox",
                "host": self._host,
                "messages": len(messages),
                "duration_ms": round((time.monotonic() - started) * 1000),
            },
        )
        return messages

    def mark_handled(self, uids: Sequence[str]) -> None:
        if not uids:
            return
        with self._session("mark handled") as imap:
            _ok(imap.uid("STORE", ",".join(uids), "+FLAGS", r"(\Seen)"), "mark handled")

    def _session(self, step: str) -> "_ImapSession":
        return _ImapSession(self, step)


class _ImapSession:
    """Logs in and selects INBOX on enter, logs out on exit, and turns IMAP trouble into
    MailboxError naming the step."""

    def __init__(self, mailbox: ImapMailbox, step: str) -> None:
        self._mailbox = mailbox
        self._step = step
        self._imap: imaplib.IMAP4 | None = None

    def __enter__(self) -> imaplib.IMAP4:
        mailbox = self._mailbox
        try:
            self._imap = mailbox._connect(mailbox._host, mailbox._timeout)
            self._imap.login(mailbox._address, mailbox._app_password)
            _ok(self._imap.select("INBOX"), "select")
        except (OSError, imaplib.IMAP4.error) as error:
            self._close()
            raise MailboxError(f"{self._step}: connect or sign in: {error}") from error
        return self._imap

    def __exit__(self, kind: object, error: BaseException | None, traceback: object) -> None:
        self._close()
        if isinstance(error, (OSError, imaplib.IMAP4.error)):
            raise MailboxError(f"{self._step}: {error}") from error

    def _close(self) -> None:
        if self._imap is None:
            return
        try:
            self._imap.logout()
        except (OSError, imaplib.IMAP4.error):
            logger.debug("mailbox logout failed", exc_info=True)


def _ok(answer: tuple[str, Sequence[object]], step: str) -> Sequence[object]:
    status, payload = answer
    if status != "OK":
        raise imaplib.IMAP4.error(f"{step} answered {status}")
    return payload


def parse_message(uid: str, raw: bytes) -> MailMessage:
    """One email as a MailMessage: who sent it, the subject and the body as plain text."""
    message = message_from_bytes(raw, policy=policy.default)
    name, address = parseaddr(str(message.get("From", "")))
    message_id = str(message.get("Message-ID", "")).strip().strip("<>") or f"uid-{uid}"
    return MailMessage(
        uid=uid,
        message_id=message_id,
        sender_address=address.lower(),
        sender_name=name or address.lower(),
        subject=" ".join(str(message.get("Subject", "")).split()),
        text=_body_text(message),
        received_at=_date(message.get("Date")),
    )


def _body_text(message: EmailMessage) -> str:
    plain = message.get_body(preferencelist=("plain",))
    if plain is not None:
        return str(plain.get_content())
    html = message.get_body(preferencelist=("html",))
    if html is not None:
        return _html_text(str(html.get_content()))
    return ""


def _date(header: object) -> datetime:
    try:
        parsed = parsedate_to_datetime(str(header))
    except (TypeError, ValueError):
        return datetime.now(UTC)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


class _TextCollector(HTMLParser):
    _HIDDEN = ("head", "script", "style")

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._hidden = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self._HIDDEN:
            self._hidden += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in self._HIDDEN and self._hidden:
            self._hidden -= 1

    def handle_data(self, data: str) -> None:
        if not self._hidden:
            self.parts.append(data)


def _html_text(html: str) -> str:
    collector = _TextCollector()
    collector.feed(html)
    collector.close()
    return re.sub(r"\s+", " ", " ".join(collector.parts)).strip()
