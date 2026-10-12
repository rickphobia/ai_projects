"""Command-line entrypoint: loads settings, sets up logging and runs a subcommand."""

import argparse
import logging
import os
import sys

import uvicorn

from rss_news.adapters.sqlite.database import DatabaseError, SqliteDatabase
from rss_news.config import ConfigError, Settings, load_settings
from rss_news.json_logging import configure_logging
from rss_news.web.app import create_app

logger = logging.getLogger(__name__)


def serve(settings: Settings) -> int:
    database = SqliteDatabase(settings.database_path)
    try:
        database.migrate()
    except DatabaseError as error:
        logger.error("database unusable: %s", error)
        return 2
    app = create_app(settings, database=database)
    logger.info(
        "starting web server",
        extra={"host": settings.host, "port": settings.port, "root_path": settings.root_path},
    )
    # log_config=None keeps uvicorn's loggers on our JSON handler instead of its own format.
    uvicorn.run(app, host=settings.host, port=settings.port, log_config=None)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="rss-news")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("serve", help="run the web server: the API, the PWA and /healthz")
    parser.parse_args(argv)

    # Log the config error as JSON too; the configured level isn't known until it loads.
    configure_logging("INFO")
    try:
        settings = load_settings(os.environ)
    except ConfigError as error:
        logger.error("invalid configuration: %s", error)
        return 2
    configure_logging(settings.log_level)
    return serve(settings)


if __name__ == "__main__":
    sys.exit(main())
