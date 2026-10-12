import json
from pathlib import Path

import pytest

from rss_news.cli import main
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


def test_serve_is_the_only_subcommand() -> None:
    with pytest.raises(SystemExit):
        main(["fetch"])
