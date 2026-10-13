"""The IMAP Mailbox against a saved newsletter email, over a stand-in IMAP server."""

import imaplib
from datetime import UTC, datetime
from pathlib import Path

import pytest

from rss_news.adapters.mailbox import ImapMailbox, parse_message
from rss_news.newsletters.collecting import MailboxError

NEWSLETTER = (Path(__file__).parent / "mail" / "newsletter.eml").read_bytes()


def test_a_saved_newsletter_becomes_a_message_with_its_sender_subject_and_text() -> None:
    message = parse_message("7", NEWSLETTER)

    assert message.uid == "7"
    assert message.message_id == "issue-42.abc123@mail.example-weekly.com"
    assert message.sender_address == "hello@example-weekly.com"
    assert message.sender_name == "The Example Weekly"
    assert message.subject == "Issue 42: Chips, cafés and the cloud"
    assert message.received_at == datetime(2026, 10, 11, 23, 30, tzinfo=UTC)
    # The HTML body without its head, styles or scripts.
    assert message.text == "This week Chip makers raised prices & the café chain went public."


def test_a_sender_without_a_display_name_is_named_by_address() -> None:
    raw = b"From: news@example.com\r\nSubject: Hi\r\n\r\nPlain body\r\n"

    message = parse_message("1", raw)

    assert message.sender_name == "news@example.com"
    assert message.text.strip() == "Plain body"
    assert message.message_id == "uid-1"


class StandInImap:
    """Answers like Gmail's IMAP server with one unread message."""

    def __init__(self, *, refuse_login: bool = False) -> None:
        self.refuse_login = refuse_login
        self.commands: list[tuple[str, ...]] = []
        self.logged_out = False

    def login(self, user: str, password: str) -> tuple[str, list[bytes]]:
        if self.refuse_login:
            raise imaplib.IMAP4.error("[AUTHENTICATIONFAILED] Invalid credentials")
        return "OK", [b"signed in"]

    def select(self, mailbox: str) -> tuple[str, list[bytes]]:
        return "OK", [b"1"]

    def uid(self, command: str, *args: str) -> tuple[str, list[object]]:
        self.commands.append((command, *args))
        if command == "SEARCH":
            return "OK", [b"7"]
        if command == "FETCH":
            return "OK", [(b"7 (UID 7 BODY[] {100}", NEWSLETTER), b")"]
        return "OK", [b"done"]

    def logout(self) -> tuple[str, list[bytes]]:
        self.logged_out = True
        return "BYE", [b""]


def mailbox(server: StandInImap) -> ImapMailbox:
    return ImapMailbox(
        host="imap.example",
        address="owner@example.com",
        app_password="not-a-real-password",
        timeout_seconds=5,
        connect=lambda host, timeout: server,  # type: ignore[arg-type, return-value]
    )


def test_unread_messages_are_read_without_marking_them_and_then_marked_handled() -> None:
    server = StandInImap()

    (message,) = mailbox(server).unhandled()
    mailbox(server).mark_handled([message.uid])

    assert message.subject.startswith("Issue 42")
    assert server.commands == [
        ("SEARCH", "UNSEEN"),
        ("FETCH", "7", "(BODY.PEEK[])"),
        ("STORE", "7", "+FLAGS", r"(\Seen)"),
    ]
    assert server.logged_out


def test_a_refused_sign_in_is_a_mailbox_error_naming_the_step() -> None:
    with pytest.raises(MailboxError, match=r"read: connect or sign in: .*AUTHENTICATIONFAILED"):
        mailbox(StandInImap(refuse_login=True)).unhandled()
