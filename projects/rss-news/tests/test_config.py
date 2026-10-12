from datetime import timedelta
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from rss_news.alerts.vapid_keys import generate_vapid_private_key, parse_vapid_private_key
from rss_news.auth.passwords import parse_password_hash
from rss_news.config import ConfigError, Settings, load_settings
from rss_news.spending.ledger import ModelPrice
from tests.support import OWNER_PASSWORD_HASH, SESSION_SECRET, fake_pwa_build

SECRETS = {
    "RSS_NEWS_PASSWORD_HASH": OWNER_PASSWORD_HASH,
    "RSS_NEWS_SESSION_SECRET": SESSION_SECRET,
    "RSS_NEWS_ANTHROPIC_API_KEY": "sk-ant-test",
}
DEFAULT_PRICES = {
    "claude-haiku-5-5": ModelPrice(Decimal("0.10"), Decimal("0.50")),
    "claude-sonnet-5-5": ModelPrice(Decimal(2), Decimal(10)),
    "claude-opus-5-5": ModelPrice(Decimal(4), Decimal(20)),
}

VAPID_PRIVATE_KEY = generate_vapid_private_key()


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
        fetch_interval=timedelta(minutes=15),
        reddit_gap=timedelta(seconds=10),
        reddit_interval=timedelta(minutes=60),
        fetch_max_backoff=timedelta(hours=24),
        fetch_timeout=timedelta(seconds=20),
        user_agent="rss-news/0.1 (+https://rickphobia.com/ai-projects/rss-news/)",
        item_max_age=timedelta(days=90),
        anthropic_api_key="sk-ant-test",
        anthropic_timeout=timedelta(seconds=120),
        anthropic_max_attempts=4,
        scoring_model="claude-haiku-5-5",
        scoring_batch_size=100,
        scoring_prompt_token_limit=90_000,
        briefing_model="claude-opus-5-5",
        briefing_effort="low",
        briefing_token_budget=40_000,
        briefing_importance_cutoff=3,
        chat_model="claude-opus-5-5",
        chat_effort="low",
        chat_compaction_tokens=70_000,
        dictionary_model="claude-haiku-5-5",
        model_prices=DEFAULT_PRICES,
        web_search_price_usd=Decimal("0.01"),
        monthly_limit_usd=Decimal("100"),
        vapid_key=None,
        vapid_subject="https://rickphobia.com/ai-projects/rss-news/",
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
            "RSS_NEWS_FETCH_INTERVAL_MINUTES": "30",
            "RSS_NEWS_REDDIT_GAP_SECONDS": "20",
            "RSS_NEWS_REDDIT_INTERVAL_MINUTES": "120",
            "RSS_NEWS_FETCH_MAX_BACKOFF_HOURS": "6",
            "RSS_NEWS_FETCH_TIMEOUT_SECONDS": "5",
            "RSS_NEWS_USER_AGENT": "my-reader/1.0",
            "RSS_NEWS_ITEM_MAX_AGE_DAYS": "30",
            "RSS_NEWS_ANTHROPIC_TIMEOUT_SECONDS": "30",
            "RSS_NEWS_ANTHROPIC_MAX_ATTEMPTS": "2",
            "RSS_NEWS_SCORING_MODEL": "claude-sonnet-5-5",
            "RSS_NEWS_SCORING_BATCH_SIZE": "20",
            "RSS_NEWS_SCORING_PROMPT_TOKEN_LIMIT": "50000",
            "RSS_NEWS_BRIEFING_MODEL": "claude-sonnet-5-5",
            "RSS_NEWS_BRIEFING_EFFORT": "Medium",
            "RSS_NEWS_BRIEFING_TOKEN_BUDGET": "20000",
            "RSS_NEWS_BRIEFING_IMPORTANCE_CUTOFF": "4",
            "RSS_NEWS_CHAT_MODEL": "claude-sonnet-5-5",
            "RSS_NEWS_CHAT_EFFORT": "high",
            "RSS_NEWS_CHAT_COMPACTION_TOKENS": "100000",
            "RSS_NEWS_DICTIONARY_MODEL": "claude-sonnet-5-5",
            "RSS_NEWS_MODEL_PRICES": "claude-sonnet-5-5=2.5/12, claude-haiku-5-5=0.1/0.5",
            "RSS_NEWS_WEB_SEARCH_PRICE_USD": "0.02",
            "RSS_NEWS_MONTHLY_LIMIT_USD": "25.50",
            "RSS_NEWS_VAPID_PRIVATE_KEY": VAPID_PRIVATE_KEY,
            "RSS_NEWS_VAPID_SUBJECT": "mailto:owner@example.com",
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
        fetch_interval=timedelta(minutes=30),
        reddit_gap=timedelta(seconds=20),
        reddit_interval=timedelta(minutes=120),
        fetch_max_backoff=timedelta(hours=6),
        fetch_timeout=timedelta(seconds=5),
        user_agent="my-reader/1.0",
        item_max_age=timedelta(days=30),
        anthropic_api_key="sk-ant-test",
        anthropic_timeout=timedelta(seconds=30),
        anthropic_max_attempts=2,
        scoring_model="claude-sonnet-5-5",
        scoring_batch_size=20,
        scoring_prompt_token_limit=50_000,
        briefing_model="claude-sonnet-5-5",
        briefing_effort="medium",
        briefing_token_budget=20_000,
        briefing_importance_cutoff=4,
        chat_model="claude-sonnet-5-5",
        chat_effort="high",
        chat_compaction_tokens=100_000,
        dictionary_model="claude-sonnet-5-5",
        model_prices={
            "claude-sonnet-5-5": ModelPrice(Decimal("2.5"), Decimal(12)),
            "claude-haiku-5-5": ModelPrice(Decimal("0.1"), Decimal("0.5")),
        },
        web_search_price_usd=Decimal("0.02"),
        monthly_limit_usd=Decimal("25.50"),
        vapid_key=parse_vapid_private_key(VAPID_PRIVATE_KEY),
        vapid_subject="mailto:owner@example.com",
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
        ("RSS_NEWS_FETCH_INTERVAL_MINUTES", "0", "RSS_NEWS_FETCH_INTERVAL_MINUTES must be at"),
        ("RSS_NEWS_FETCH_TIMEOUT_SECONDS", "x", "RSS_NEWS_FETCH_TIMEOUT_SECONDS must be a whole"),
        ("RSS_NEWS_REDDIT_GAP_SECONDS", "0", "RSS_NEWS_REDDIT_GAP_SECONDS must be at least 1"),
        (
            "RSS_NEWS_FETCH_MAX_BACKOFF_HOURS",
            "x",
            "RSS_NEWS_FETCH_MAX_BACKOFF_HOURS must be a whole",
        ),
        ("RSS_NEWS_USER_AGENT", " ", "RSS_NEWS_USER_AGENT must not be blank"),
        ("RSS_NEWS_ANTHROPIC_API_KEY", "", "RSS_NEWS_ANTHROPIC_API_KEY is required"),
        ("RSS_NEWS_ANTHROPIC_MAX_ATTEMPTS", "0", "RSS_NEWS_ANTHROPIC_MAX_ATTEMPTS must be at"),
        ("RSS_NEWS_SCORING_MODEL", "claude-unknown", "has no price in RSS_NEWS_MODEL_PRICES"),
        ("RSS_NEWS_BRIEFING_MODEL", "claude-unknown", "has no price in RSS_NEWS_MODEL_PRICES"),
        ("RSS_NEWS_BRIEFING_EFFORT", "max", "RSS_NEWS_BRIEFING_EFFORT must be one of"),
        ("RSS_NEWS_CHAT_EFFORT", "max", "RSS_NEWS_CHAT_EFFORT must be one of"),
        ("RSS_NEWS_CHAT_MODEL", "gpt-9", "has no price in RSS_NEWS_MODEL_PRICES"),
        ("RSS_NEWS_BRIEFING_TOKEN_BUDGET", "0", "RSS_NEWS_BRIEFING_TOKEN_BUDGET must be at"),
        ("RSS_NEWS_BRIEFING_IMPORTANCE_CUTOFF", "6", "must be an Importance from 1 to 5"),
        ("RSS_NEWS_MODEL_PRICES", "claude-haiku-5-5=cheap", "must look like 'model=input/output"),
        ("RSS_NEWS_MODEL_PRICES", "claude-haiku-5-5=-1/2", "must look like 'model=input/output"),
        ("RSS_NEWS_MODEL_PRICES", "=1/2", "must look like 'model=input/output"),
        ("RSS_NEWS_WEB_SEARCH_PRICE_USD", "free", "RSS_NEWS_WEB_SEARCH_PRICE_USD must be an"),
        ("RSS_NEWS_WEB_SEARCH_PRICE_USD", "-0.01", "must be zero or more"),
        ("RSS_NEWS_MONTHLY_LIMIT_USD", "lots", "RSS_NEWS_MONTHLY_LIMIT_USD must be an"),
        ("RSS_NEWS_VAPID_PRIVATE_KEY", "abc", "not a key from `rss-news vapid-key`"),
        ("RSS_NEWS_VAPID_SUBJECT", "owner@example.com", "must be a mailto: or https:// URL"),
    ],
)
def test_a_bad_value_is_rejected_naming_the_variable(
    pwa_dir: Path, name: str, value: str, message: str
) -> None:
    with pytest.raises(ConfigError, match=message):
        load_settings({"RSS_NEWS_PWA_DIR": str(pwa_dir), **SECRETS, name: value})


def test_the_secrets_are_kept_out_of_the_settings_repr(pwa_dir: Path) -> None:
    text = repr(
        load_settings(
            {
                "RSS_NEWS_PWA_DIR": str(pwa_dir),
                **SECRETS,
                "RSS_NEWS_VAPID_PRIVATE_KEY": VAPID_PRIVATE_KEY,
            }
        )
    )

    assert SESSION_SECRET not in text
    assert "sk-ant-test" not in text
    assert "scrypt" not in text
    assert VAPID_PRIVATE_KEY not in text


def test_a_pwa_folder_without_a_build_is_rejected(tmp_path: Path) -> None:
    with pytest.raises(ConfigError, match=r"RSS_NEWS_PWA_DIR .*`npm run build`"):
        load_settings({"RSS_NEWS_PWA_DIR": str(tmp_path)})


def test_a_missing_pwa_folder_is_rejected_with_the_default_named(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.chdir(tmp_path)

    with pytest.raises(ConfigError, match="RSS_NEWS_PWA_DIR"):
        load_settings({})
