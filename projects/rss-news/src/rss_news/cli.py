"""Command-line entrypoint: loads settings, sets up logging and runs a subcommand."""

import argparse
import getpass
import logging
import os
import sys
from typing import TextIO

import uvicorn

from rss_news.adapters.article_extractor import TrafilaturaArticleExtractor
from rss_news.adapters.feed_fetcher import HttpFeedFetcher
from rss_news.adapters.language_model import AnthropicLanguageModel
from rss_news.adapters.sqlite.database import DatabaseError, SqliteDatabase
from rss_news.auth.passwords import hash_password
from rss_news.clock import SystemClock
from rss_news.config import ConfigError, Settings, load_settings
from rss_news.json_logging import configure_logging
from rss_news.sources.starter import STARTER_FOLDERS
from rss_news.wiring import build_app

logger = logging.getLogger(__name__)


def serve(settings: Settings) -> int:
    database = SqliteDatabase(settings.database_path)
    try:
        database.migrate()
    except DatabaseError as error:
        logger.error("database unusable: %s", error)
        return 2
    clock = SystemClock()
    feed_fetcher = HttpFeedFetcher(
        user_agent=settings.user_agent, timeout=settings.fetch_timeout, clock=clock
    )
    article_extractor = TrafilaturaArticleExtractor(
        user_agent=settings.user_agent, timeout=settings.fetch_timeout
    )
    language_model = AnthropicLanguageModel(
        api_key=settings.anthropic_api_key,
        scoring_model=settings.scoring_model,
        briefing_model=settings.briefing_model,
        briefing_effort=settings.briefing_effort,
        chat_model=settings.chat_model,
        chat_effort=settings.chat_effort,
        timeout=settings.anthropic_timeout,
        max_attempts=settings.anthropic_max_attempts,
    )
    wiring = build_app(
        settings,
        database=database,
        feed_fetcher=feed_fetcher,
        language_model=language_model,
        article_extractor=article_extractor,
        clock=clock,
        starter_folders=STARTER_FOLDERS,
        run_tick_loop=True,
    )
    logger.info(
        "starting web server",
        extra={"host": settings.host, "port": settings.port, "root_path": settings.root_path},
    )
    try:
        # log_config=None keeps uvicorn's loggers on our JSON handler instead of its own format.
        uvicorn.run(wiring.app, host=settings.host, port=settings.port, log_config=None)
    finally:
        feed_fetcher.close()
        article_extractor.close()
        language_model.close()
    return 0


def print_password_hash(stdin: TextIO, stdout: TextIO, stderr: TextIO) -> int:
    """Ask for the owner password and print its hash for RSS_NEWS_PASSWORD_HASH.

    At a terminal the password is asked twice without echo; piped in, the first line is read.
    """
    if stdin.isatty():
        password = getpass.getpass("Owner password: ")
        if getpass.getpass("Same password again: ") != password:
            print("The passwords don't match; nothing printed.", file=stderr)
            return 1
    else:
        password = stdin.readline().rstrip("\r\n")
    if not password:
        print("The password must not be empty.", file=stderr)
        return 1
    print(hash_password(password), file=stdout)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="rss-news")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("serve", help="run the web server: the API, the PWA and /healthz")
    commands.add_parser("hash-password", help="print the owner password's hash for the env file")
    args = parser.parse_args(argv)
    if args.command == "hash-password":
        # Needs no settings, so it works before the env file exists.
        return print_password_hash(sys.stdin, sys.stdout, sys.stderr)

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
