"""JSON-lines logging on stdout, so Docker and Dozzle can show and filter every field."""

import json
import logging
import sys
from datetime import UTC, datetime
from typing import Any, TextIO

# Attributes every LogRecord has; anything else on a record came from `extra=` and is logged.
# uvicorn adds "color_message", a copy of the message with terminal colour codes.
_SKIPPED_ATTRIBUTES = frozenset(vars(logging.makeLogRecord({}))) | {
    "message",
    "asctime",
    "color_message",
}


class JsonLinesFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, Any] = {
            "time": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key, value in vars(record).items():
            if key not in _SKIPPED_ATTRIBUTES:
                entry[key] = value
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(entry, default=str)


def configure_logging(level: str, stream: TextIO | None = None) -> None:
    """Send every logger's records, uvicorn's included, to `stream` (stdout) as JSON lines."""
    handler = logging.StreamHandler(stream or sys.stdout)
    handler.setFormatter(JsonLinesFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)
