import io
import json
from pathlib import Path

import pytest

from rss_news.alerts.vapid_keys import parse_vapid_private_key
from rss_news.auth.passwords import parse_password_hash
from rss_news.cli import main, print_password_hash
from tests.support import app_env


def test_a_bad_setting_stops_startup_with_a_message_naming_it(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str], tmp_path: Path
) -> None:
    for name, value in app_env(tmp_path, RSS_NEWS_TIMEZONE="Nowhere/Atall").items():
        monkeypatch.setenv(name, value)

    assert main(["serve"]) == 2

    record = json.loads(capsys.readouterr().out)
    assert record["level"] == "ERROR"
    assert "RSS_NEWS_TIMEZONE" in record["message"]


def test_an_unusable_database_path_stops_startup(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str], tmp_path: Path
) -> None:
    # A file where the database's folder should be.
    (tmp_path / "blocked").write_text("")
    env = app_env(tmp_path, RSS_NEWS_DATABASE_PATH=str(tmp_path / "blocked" / "db.sqlite3"))
    for name, value in env.items():
        monkeypatch.setenv(name, value)

    assert main(["serve"]) == 2

    record = json.loads(capsys.readouterr().out.splitlines()[-1])
    assert record["level"] == "ERROR"
    assert "database unusable" in record["message"]


def test_an_unknown_subcommand_is_refused() -> None:
    with pytest.raises(SystemExit):
        main(["fetch"])


class TerminalInput(io.StringIO):
    def isatty(self) -> bool:
        return True


def test_hash_password_runs_without_any_settings(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.delenv("RSS_NEWS_PASSWORD_HASH", raising=False)
    monkeypatch.setattr("sys.stdin", io.StringIO("piped password\n"))

    assert main(["hash-password"]) == 0

    printed = capsys.readouterr().out.strip()
    assert parse_password_hash(printed).matches("piped password")


def test_hash_password_at_a_terminal_asks_twice_without_echo(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    answers = iter(["typed password", "typed password"])
    monkeypatch.setattr("getpass.getpass", lambda prompt: next(answers))
    stdout, stderr = io.StringIO(), io.StringIO()

    assert print_password_hash(TerminalInput(), stdout, stderr) == 0

    assert parse_password_hash(stdout.getvalue()).matches("typed password")
    assert "typed password" not in stdout.getvalue()


def test_hash_password_refuses_two_different_passwords(monkeypatch: pytest.MonkeyPatch) -> None:
    answers = iter(["first", "second"])
    monkeypatch.setattr("getpass.getpass", lambda prompt: next(answers))
    stdout, stderr = io.StringIO(), io.StringIO()

    assert print_password_hash(TerminalInput(), stdout, stderr) == 1
    assert stdout.getvalue() == ""


def test_hash_password_refuses_an_empty_password(monkeypatch: pytest.MonkeyPatch) -> None:
    stdout, stderr = io.StringIO(), io.StringIO()

    assert print_password_hash(io.StringIO("\n"), stdout, stderr) == 1
    assert "must not be empty" in stderr.getvalue()


def test_vapid_key_prints_a_new_key_line_without_any_settings(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.delenv("RSS_NEWS_PASSWORD_HASH", raising=False)

    assert main(["vapid-key"]) == 0

    name, _, key = capsys.readouterr().out.strip().partition("=")
    assert name == "RSS_NEWS_VAPID_PRIVATE_KEY"
    parse_vapid_private_key(key)
