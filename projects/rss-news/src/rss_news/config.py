"""Every setting rss-news reads, loaded from the environment and validated once at startup."""

from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

LOG_LEVELS = ("DEBUG", "INFO", "WARNING", "ERROR")


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


def load_settings(environ: Mapping[str, str]) -> Settings:
    """Build Settings from `environ`, raising ConfigError that names the first bad variable."""
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
    )


def _log_level(environ: Mapping[str, str], name: str, *, default: str) -> str:
    value = environ.get(name, default).strip().upper()
    if value not in LOG_LEVELS:
        raise ConfigError(f"{name} must be one of {', '.join(LOG_LEVELS)}, got {value!r}")
    return value


def _non_blank(environ: Mapping[str, str], name: str, *, default: str) -> str:
    value = environ.get(name, default).strip()
    if not value:
        raise ConfigError(f"{name} must not be blank")
    return value


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
