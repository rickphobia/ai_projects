from datetime import timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from rss_news.auth.passwords import parse_password_hash
from rss_news.config import ConfigError, Settings, load_settings
from tests.support import OWNER_PASSWORD_HASH, SESSION_SECRET, fake_pwa_build

SECRETS = {
    "RSS_NEWS_PASSWORD_HASH": OWNER_PASSWORD_HASH,
    "RSS_NEWS_SESSION_SECRET": SESSION_SECRET,
}


@pytest.fixture
def pwa_dir(tmp_path: Path) -> Path:
    return fake_pwa_build(tmp_path / "pwa")


def test_defaults_apply_when_only_the_pwa_folder_and_secrets_are_set(pwa_dir: Path) -> None:
    assert load_settings({"RSS_NEWS_PWA_DIR": str(pwa_dir), **SECRETS}) == Settings(
        log_level="INFO",
        host="127.0.0.1",
        port=8000,
        root_path="/ai-projects/rss-news",
        database_path=Path("data/rss-news.sqlite3"),
        pwa_dir=pwa_dir,
        timezone=ZoneInfo("Asia/Kuala_Lumpur"),
        password_hash=parse_password_hash(OWNER_PASSWORD_HASH),
        session_secret=SESSION_SECRET.encode(),
        session_lifetime=timedelta(days=60),
        secure_cookies=True,
        login_max_failures=5,
        login_lockout=timedelta(minutes=15),
    )


def test_reads_every_setting_from_the_environment(pwa_dir: Path) -> None:
    settings = load_settings(
        {
            "RSS_NEWS_LOG_LEVEL": "debug",
            "RSS_NEWS_HOST": "0.0.0.0",
            "RSS_NEWS_PORT": "9000",
            "RSS_NEWS_ROOT_PATH": "/elsewhere/",
            "RSS_NEWS_DATABASE_PATH": "/data/news.sqlite3",
            "RSS_NEWS_PWA_DIR": str(pwa_dir),
            "RSS_NEWS_TIMEZONE": "Europe/London",
            **SECRETS,
            "RSS_NEWS_SESSION_DAYS": "7",
            "RSS_NEWS_SECURE_COOKIES": "false",
            "RSS_NEWS_LOGIN_MAX_FAILURES": "3",
            "RSS_NEWS_LOGIN_LOCKOUT_MINUTES": "60",
        }
    )

    assert settings == Settings(
        log_level="DEBUG",
        host="0.0.0.0",
        port=9000,
        root_path="/elsewhere",
        database_path=Path("/data/news.sqlite3"),
        pwa_dir=pwa_dir,
        timezone=ZoneInfo("Europe/London"),
        password_hash=parse_password_hash(OWNER_PASSWORD_HASH),
        session_secret=SESSION_SECRET.encode(),
        session_lifetime=timedelta(days=7),
        secure_cookies=False,
        login_max_failures=3,
        login_lockout=timedelta(minutes=60),
    )


@pytest.mark.parametrize(
    ("name", "value", "message"),
    [
        ("RSS_NEWS_LOG_LEVEL", "LOUD", "RSS_NEWS_LOG_LEVEL must be one of"),
        ("RSS_NEWS_HOST", " ", "RSS_NEWS_HOST must not be blank"),
        ("RSS_NEWS_PORT", "eighty", "RSS_NEWS_PORT must be a whole number"),
        ("RSS_NEWS_PORT", "70000", "RSS_NEWS_PORT must be between 1 and 65535"),
        ("RSS_NEWS_ROOT_PATH", "ai-projects/rss-news", "RSS_NEWS_ROOT_PATH must start with '/'"),
        ("RSS_NEWS_DATABASE_PATH", "", "RSS_NEWS_DATABASE_PATH must not be blank"),
        ("RSS_NEWS_TIMEZONE", "Mars/Olympus", "RSS_NEWS_TIMEZONE must be an IANA time zone"),
        ("RSS_NEWS_PASSWORD_HASH", "", "RSS_NEWS_PASSWORD_HASH is required"),
        ("RSS_NEWS_PASSWORD_HASH", "hunter2", "not a hash from `rss-news hash-password`"),
        ("RSS_NEWS_SESSION_SECRET", "", "RSS_NEWS_SESSION_SECRET is required"),
        ("RSS_NEWS_SESSION_SECRET", "short", "at least 32 characters"),
        ("RSS_NEWS_SESSION_DAYS", "0", "RSS_NEWS_SESSION_DAYS must be at least 1"),
        ("RSS_NEWS_SECURE_COOKIES", "yes", "RSS_NEWS_SECURE_COOKIES must be true or false"),
        ("RSS_NEWS_LOGIN_MAX_FAILURES", "x", "RSS_NEWS_LOGIN_MAX_FAILURES must be a whole"),
    ],
)
def test_a_bad_value_is_rejected_naming_the_variable(
    pwa_dir: Path, name: str, value: str, message: str
) -> None:
    with pytest.raises(ConfigError, match=message):
        load_settings({"RSS_NEWS_PWA_DIR": str(pwa_dir), **SECRETS, name: value})


def test_the_secrets_are_kept_out_of_the_settings_repr(pwa_dir: Path) -> None:
    text = repr(load_settings({"RSS_NEWS_PWA_DIR": str(pwa_dir), **SECRETS}))

    assert SESSION_SECRET not in text
    assert "scrypt" not in text


def test_a_pwa_folder_without_a_build_is_rejected(tmp_path: Path) -> None:
    with pytest.raises(ConfigError, match=r"RSS_NEWS_PWA_DIR .*`npm run build`"):
        load_settings({"RSS_NEWS_PWA_DIR": str(tmp_path)})


def test_a_missing_pwa_folder_is_rejected_with_the_default_named(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.chdir(tmp_path)

    with pytest.raises(ConfigError, match="RSS_NEWS_PWA_DIR"):
        load_settings({})
