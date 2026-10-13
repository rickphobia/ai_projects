"""Every setting rss-news reads, loaded from the environment and validated once at startup."""

import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import time, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Literal, cast
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from rss_news.alerts.rules import QuietHours
from rss_news.alerts.vapid_keys import InvalidVapidKey, VapidKey, parse_vapid_private_key
from rss_news.auth.passwords import InvalidPasswordHash, PasswordHash, parse_password_hash
from rss_news.spending.ledger import ModelPrice

LOG_LEVELS = ("DEBUG", "INFO", "WARNING", "ERROR")
EFFORTS = ("low", "medium", "high")
type Effort = Literal["low", "medium", "high"]
_MIN_SESSION_SECRET_LENGTH = 32


class ConfigError(Exception):
    """A setting is missing or has a value rss-news can't use."""


@dataclass(frozen=True)
class Settings:
    log_level: str
    host: str
    port: int
    # The public path prefix the host nginx serves the app under.
    root_path: str
    database_path: Path
    # The built PWA (index.html and its assets), served under the path prefix.
    pwa_dir: Path
    # The owner's time zone: windows like "last 24 hours" and shown times use it.
    timezone: ZoneInfo
    password_hash: PasswordHash = field(repr=False)
    session_secret: bytes = field(repr=False)
    session_lifetime: timedelta
    # Off only for local runs over plain http; the public site is https.
    secure_cookies: bool
    login_max_failures: int
    login_lockout: timedelta
    # How long after a successful fetch a Source is due again.
    fetch_interval: timedelta
    # Reddit refused most anonymous feed requests 10 seconds apart; 60 gets them all through.
    reddit_gap: timedelta
    reddit_interval: timedelta
    # Failing Sources back off by doubling their interval, up to this.
    fetch_max_backoff: timedelta
    fetch_timeout: timedelta
    # Sent with every feed request, so site owners can see who is asking.
    user_agent: str
    # Items that arrived longer ago than this are deleted.
    item_max_age: timedelta
    anthropic_api_key: str = field(repr=False)
    anthropic_timeout: timedelta
    # Tries per AI call, the first included; network errors, 429 and 5xx are tried again.
    anthropic_max_attempts: int
    scoring_model: str
    # Items per scoring call; a call's prompt also stays under the token limit below.
    scoring_batch_size: int
    # Haiku costs 5x more for prompts over 100K tokens, so scoring calls stay under this.
    scoring_prompt_token_limit: int
    briefing_model: str
    # How hard the Briefing model thinks; low keeps a Briefing at a few tens of cents.
    briefing_effort: Effort
    # Most estimated prompt tokens per Briefing section call.
    briefing_token_budget: int
    # 7 and 30 day Briefings only read Items with at least this Importance.
    briefing_importance_cutoff: int
    chat_model: str
    # How hard the Chat model thinks; low keeps a question at a few cents.
    chat_effort: Effort
    # Past this many prompt tokens the API summarises a Chat's older turns (compaction).
    chat_compaction_tokens: int
    # Defines selected words; a cheap model is plenty for a sentence or two.
    dictionary_model: str
    # USD per million input and output tokens, by model name. Every configured model needs one.
    model_prices: Mapping[str, ModelPrice]
    web_search_price_usd: Decimal
    # At 80% the app warns; at 100% Briefings stop, while scoring keeps running.
    monthly_limit_usd: Decimal
    # Signs Web Push messages. None leaves Alerts off; the rest of the app works without it.
    vapid_key: VapidKey | None = field(repr=False)
    # Who push services contact about our messages: a mailto: or https: URL.
    vapid_subject: str
    # No Alerts in these hours, in the owner's time zone; they're dropped, not sent later.
    alert_quiet_hours: QuietHours
    # Most Alerts sent per day, counted from midnight in the owner's time zone.
    alert_daily_cap: int


def load_settings(environ: Mapping[str, str]) -> Settings:
    """Build Settings from `environ`, raising ConfigError that names the first bad variable."""
    model_prices = _model_prices(environ, "RSS_NEWS_MODEL_PRICES", default=DEFAULT_MODEL_PRICES)
    return Settings(
        log_level=_log_level(environ, "RSS_NEWS_LOG_LEVEL", default="INFO"),
        host=_non_blank(environ, "RSS_NEWS_HOST", default="127.0.0.1"),
        port=_port(environ, "RSS_NEWS_PORT", default=8000),
        root_path=_root_path(environ, "RSS_NEWS_ROOT_PATH", default="/ai-projects/rss-news"),
        database_path=Path(
            _non_blank(environ, "RSS_NEWS_DATABASE_PATH", default="data/rss-news.sqlite3")
        ),
        pwa_dir=_pwa_dir(environ, "RSS_NEWS_PWA_DIR", default="pwa/dist"),
        timezone=_timezone(environ, "RSS_NEWS_TIMEZONE", default="Asia/Kuala_Lumpur"),
        password_hash=_password_hash(environ, "RSS_NEWS_PASSWORD_HASH"),
        session_secret=_session_secret(environ, "RSS_NEWS_SESSION_SECRET"),
        session_lifetime=timedelta(
            days=_positive_int(environ, "RSS_NEWS_SESSION_DAYS", default=60)
        ),
        secure_cookies=_boolean(environ, "RSS_NEWS_SECURE_COOKIES", default=True),
        login_max_failures=_positive_int(environ, "RSS_NEWS_LOGIN_MAX_FAILURES", default=5),
        login_lockout=timedelta(
            minutes=_positive_int(environ, "RSS_NEWS_LOGIN_LOCKOUT_MINUTES", default=15)
        ),
        fetch_interval=timedelta(
            minutes=_positive_int(environ, "RSS_NEWS_FETCH_INTERVAL_MINUTES", default=15)
        ),
        reddit_gap=timedelta(
            seconds=_positive_int(environ, "RSS_NEWS_REDDIT_GAP_SECONDS", default=60)
        ),
        reddit_interval=timedelta(
            minutes=_positive_int(environ, "RSS_NEWS_REDDIT_INTERVAL_MINUTES", default=60)
        ),
        fetch_max_backoff=timedelta(
            hours=_positive_int(environ, "RSS_NEWS_FETCH_MAX_BACKOFF_HOURS", default=24)
        ),
        fetch_timeout=timedelta(
            seconds=_positive_int(environ, "RSS_NEWS_FETCH_TIMEOUT_SECONDS", default=20)
        ),
        user_agent=_non_blank(
            environ,
            "RSS_NEWS_USER_AGENT",
            default="rss-news/0.1 (+https://rickphobia.com/ai-projects/rss-news/)",
        ),
        item_max_age=timedelta(
            days=_positive_int(environ, "RSS_NEWS_ITEM_MAX_AGE_DAYS", default=90)
        ),
        anthropic_api_key=_required(environ, "RSS_NEWS_ANTHROPIC_API_KEY"),
        anthropic_timeout=timedelta(
            seconds=_positive_int(environ, "RSS_NEWS_ANTHROPIC_TIMEOUT_SECONDS", default=120)
        ),
        anthropic_max_attempts=_positive_int(environ, "RSS_NEWS_ANTHROPIC_MAX_ATTEMPTS", default=4),
        scoring_model=_priced_model(
            environ, "RSS_NEWS_SCORING_MODEL", default="claude-haiku-5-5", prices=model_prices
        ),
        scoring_batch_size=_positive_int(environ, "RSS_NEWS_SCORING_BATCH_SIZE", default=100),
        scoring_prompt_token_limit=_positive_int(
            environ, "RSS_NEWS_SCORING_PROMPT_TOKEN_LIMIT", default=90_000
        ),
        briefing_model=_priced_model(
            environ, "RSS_NEWS_BRIEFING_MODEL", default="claude-opus-5-5", prices=model_prices
        ),
        briefing_effort=_effort(environ, "RSS_NEWS_BRIEFING_EFFORT", default="low"),
        briefing_token_budget=_positive_int(
            environ, "RSS_NEWS_BRIEFING_TOKEN_BUDGET", default=40_000
        ),
        briefing_importance_cutoff=_importance(
            environ, "RSS_NEWS_BRIEFING_IMPORTANCE_CUTOFF", default=3
        ),
        chat_model=_priced_model(
            environ, "RSS_NEWS_CHAT_MODEL", default="claude-opus-5-5", prices=model_prices
        ),
        chat_effort=_effort(environ, "RSS_NEWS_CHAT_EFFORT", default="low"),
        chat_compaction_tokens=_positive_int(
            environ, "RSS_NEWS_CHAT_COMPACTION_TOKENS", default=70_000
        ),
        dictionary_model=_priced_model(
            environ, "RSS_NEWS_DICTIONARY_MODEL", default="claude-haiku-5-5", prices=model_prices
        ),
        model_prices=model_prices,
        web_search_price_usd=_usd(environ, "RSS_NEWS_WEB_SEARCH_PRICE_USD", default="0.01"),
        monthly_limit_usd=_usd(environ, "RSS_NEWS_MONTHLY_LIMIT_USD", default="100"),
        vapid_key=_vapid_key(environ, "RSS_NEWS_VAPID_PRIVATE_KEY"),
        vapid_subject=_vapid_subject(
            environ,
            "RSS_NEWS_VAPID_SUBJECT",
            default="https://rickphobia.com",
        ),
        alert_quiet_hours=_quiet_hours(
            environ, "RSS_NEWS_ALERT_QUIET_HOURS", default="23:00-07:00"
        ),
        alert_daily_cap=_positive_int(environ, "RSS_NEWS_ALERT_DAILY_CAP", default=10),
    )


# From the API price list as cached on 2026-10-06: input/output USD per million tokens.
DEFAULT_MODEL_PRICES = "claude-haiku-5-5=0.10/0.50,claude-sonnet-5-5=2/10,claude-opus-5-5=4/20"


def _required(environ: Mapping[str, str], name: str) -> str:
    value = environ.get(name, "").strip()
    if not value:
        raise ConfigError(f"{name} is required (see .env.example)")
    return value


def _log_level(environ: Mapping[str, str], name: str, *, default: str) -> str:
    value = environ.get(name, default).strip().upper()
    if value not in LOG_LEVELS:
        raise ConfigError(f"{name} must be one of {', '.join(LOG_LEVELS)}, got {value!r}")
    return value


def _effort(environ: Mapping[str, str], name: str, *, default: Effort) -> Effort:
    value = environ.get(name, default).strip().lower()
    if value not in EFFORTS:
        raise ConfigError(f"{name} must be one of {', '.join(EFFORTS)}, got {value!r}")
    return cast(Effort, value)


def _non_blank(environ: Mapping[str, str], name: str, *, default: str) -> str:
    value = environ.get(name, default).strip()
    if not value:
        raise ConfigError(f"{name} must not be blank")
    return value


def _positive_int(environ: Mapping[str, str], name: str, *, default: int) -> int:
    raw = environ.get(name, str(default)).strip()
    try:
        number = int(raw)
    except ValueError:
        raise ConfigError(f"{name} must be a whole number, got {raw!r}") from None
    if number < 1:
        raise ConfigError(f"{name} must be at least 1, got {number}")
    return number


def _importance(environ: Mapping[str, str], name: str, *, default: int) -> int:
    number = _positive_int(environ, name, default=default)
    if number > 5:
        raise ConfigError(f"{name} must be an Importance from 1 to 5, got {number}")
    return number


def _boolean(environ: Mapping[str, str], name: str, *, default: bool) -> bool:
    raw = environ.get(name, "true" if default else "false").strip().lower()
    if raw not in ("true", "false"):
        raise ConfigError(f"{name} must be true or false, got {raw!r}")
    return raw == "true"


def _password_hash(environ: Mapping[str, str], name: str) -> PasswordHash:
    try:
        return parse_password_hash(_required(environ, name))
    except InvalidPasswordHash as error:
        # The message describes the format only; the value itself stays out of logs.
        raise ConfigError(f"{name} is not a hash from `rss-news hash-password`: {error}") from None


def _session_secret(environ: Mapping[str, str], name: str) -> bytes:
    value = _required(environ, name)
    if len(value) < _MIN_SESSION_SECRET_LENGTH:
        raise ConfigError(
            f"{name} must be at least {_MIN_SESSION_SECRET_LENGTH} characters "
            "(make one with `openssl rand -hex 32`)"
        )
    return value.encode()


def _port(environ: Mapping[str, str], name: str, *, default: int) -> int:
    raw = environ.get(name, str(default)).strip()
    try:
        port = int(raw)
    except ValueError:
        raise ConfigError(f"{name} must be a whole number, got {raw!r}") from None
    if not 1 <= port <= 65535:
        raise ConfigError(f"{name} must be between 1 and 65535, got {port}")
    return port


def _root_path(environ: Mapping[str, str], name: str, *, default: str) -> str:
    value = environ.get(name, default).strip()
    if not value.startswith("/"):
        raise ConfigError(f"{name} must start with '/', got {value!r}")
    return value.rstrip("/")


def _pwa_dir(environ: Mapping[str, str], name: str, *, default: str) -> Path:
    path = Path(_non_blank(environ, name, default=default))
    if not (path / "index.html").is_file():
        raise ConfigError(
            f"{name} must be a folder with the built PWA's index.html, but {path}/index.html "
            "is missing (run `npm run build` in pwa/)"
        )
    return path


def _timezone(environ: Mapping[str, str], name: str, *, default: str) -> ZoneInfo:
    value = _non_blank(environ, name, default=default)
    try:
        return ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError):
        raise ConfigError(
            f"{name} must be an IANA time zone name like Asia/Kuala_Lumpur, got {value!r}"
        ) from None


_QUIET_HOURS = re.compile(r"(\d{2}):(\d{2})-(\d{2}):(\d{2})")


def _quiet_hours(environ: Mapping[str, str], name: str, *, default: str) -> QuietHours:
    value = _non_blank(environ, name, default=default)
    match = _QUIET_HOURS.fullmatch(value)
    try:
        if match is None:
            raise ValueError(value)
        start_hour, start_minute, end_hour, end_minute = (int(part) for part in match.groups())
        return QuietHours(time(start_hour, start_minute), time(end_hour, end_minute))
    except ValueError:
        raise ConfigError(
            f"{name} must be two 24-hour times like 23:00-07:00, got {value!r}"
        ) from None


def _model_prices(environ: Mapping[str, str], name: str, *, default: str) -> dict[str, ModelPrice]:
    raw = _non_blank(environ, name, default=default)
    prices: dict[str, ModelPrice] = {}
    for entry in raw.split(","):
        model, _, price = entry.strip().partition("=")
        input_price, _, output_price = price.partition("/")
        try:
            parsed = ModelPrice(Decimal(input_price), Decimal(output_price))
        except InvalidOperation:
            parsed = None
        if not model or parsed is None or not parsed.is_valid():
            raise ConfigError(
                f"{name} must look like 'model=input/output,...' in USD per million tokens, "
                f"got {entry.strip()!r}"
            )
        prices[model] = parsed
    return prices


def _priced_model(
    environ: Mapping[str, str], name: str, *, default: str, prices: Mapping[str, ModelPrice]
) -> str:
    model = _non_blank(environ, name, default=default)
    if model not in prices:
        raise ConfigError(
            f"{name} is {model!r}, which has no price in RSS_NEWS_MODEL_PRICES; add one"
        )
    return model


def _usd(environ: Mapping[str, str], name: str, *, default: str) -> Decimal:
    raw = environ.get(name, default).strip()
    try:
        amount = Decimal(raw)
    except InvalidOperation:
        raise ConfigError(f"{name} must be an amount in USD like 0.01, got {raw!r}") from None
    if not amount.is_finite() or amount < 0:
        raise ConfigError(f"{name} must be zero or more, got {raw!r}")
    return amount


def _vapid_key(environ: Mapping[str, str], name: str) -> VapidKey | None:
    value = environ.get(name, "").strip()
    if not value:
        return None
    try:
        return parse_vapid_private_key(value)
    except InvalidVapidKey as error:
        # The message describes the format only; the key itself stays out of logs.
        raise ConfigError(f"{name} is not a key from `rss-news vapid-key`: {error}") from None


# The forms pywebpush accepts as the VAPID `sub` claim; it refuses to sign anything else, so a
# wrong subject would fail every send rather than here at startup.
_VAPID_MAILTO = re.compile(r"mailto:[^@\s]+@[\w-]+(\.[\w-]+)+", re.IGNORECASE)
_VAPID_HTTPS = re.compile(r"https://[\w-]+(\.[\w-]+)+", re.IGNORECASE)


def _vapid_subject(environ: Mapping[str, str], name: str, *, default: str) -> str:
    value = _non_blank(environ, name, default=default)
    if _VAPID_MAILTO.fullmatch(value) or _VAPID_HTTPS.fullmatch(value):
        return value
    if value.lower().startswith("https://"):
        raise ConfigError(f"{name} must be just the site, with no path or port, got {value!r}")
    raise ConfigError(
        f"{name} must be a mailto: address or an https:// site like https://example.com, "
        f"got {value!r}"
    )
