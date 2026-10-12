import io
import json
import logging
from collections.abc import Iterator

import pytest

from rss_news.json_logging import configure_logging


@pytest.fixture
def stream() -> Iterator[io.StringIO]:
    out = io.StringIO()
    yield out
    # Leave the root logger writing to stderr again, not to this test's closed stream.
    configure_logging("WARNING")


def test_each_record_is_one_json_line_with_its_extra_fields(stream: io.StringIO) -> None:
    configure_logging("INFO", stream=stream)

    logging.getLogger("rss_news.test").info("source fetched", extra={"source_id": 7})

    record = json.loads(stream.getvalue().splitlines()[0])
    assert record["level"] == "INFO"
    assert record["logger"] == "rss_news.test"
    assert record["message"] == "source fetched"
    assert record["source_id"] == 7
    assert "time" in record


def test_records_below_the_level_are_dropped(stream: io.StringIO) -> None:
    configure_logging("WARNING", stream=stream)

    logging.getLogger("rss_news.test").info("quiet")

    assert stream.getvalue() == ""


def test_exceptions_are_logged_with_their_traceback(stream: io.StringIO) -> None:
    configure_logging("INFO", stream=stream)

    try:
        raise ValueError("boom")
    except ValueError:
        logging.getLogger("rss_news.test").exception("step failed")

    record = json.loads(stream.getvalue())
    assert "ValueError: boom" in record["exception"]
