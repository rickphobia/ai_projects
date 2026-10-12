from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from rss_news.adapters.sqlite.database import SqliteDatabase
from rss_news.config import load_settings
from rss_news.web.app import create_app
from tests.support import PREFIX, PWA_INDEX, app_env


class UnreachableDatabase:
    def is_reachable(self) -> bool:
        return False


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    settings = load_settings(app_env(tmp_path))
    database = SqliteDatabase(settings.database_path)
    database.migrate()
    return TestClient(create_app(settings, database=database))


def test_healthz_answers_ok_under_the_path_prefix(client: TestClient) -> None:
    response = client.get(f"{PREFIX}/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_healthz_fails_when_the_database_is_unreachable(tmp_path: Path) -> None:
    client = TestClient(
        create_app(load_settings(app_env(tmp_path)), database=UnreachableDatabase())
    )

    response = client.get(f"{PREFIX}/healthz")

    assert response.status_code == 503
    assert response.json() == {"status": "failing", "database": "unreachable"}


def test_the_pwa_loads_under_the_path_prefix(client: TestClient) -> None:
    response = client.get(f"{PREFIX}/")

    assert response.status_code == 200
    assert response.text == PWA_INDEX


def test_the_pwa_assets_load_under_the_path_prefix(client: TestClient) -> None:
    response = client.get(f"{PREFIX}/assets/main.js")

    assert response.status_code == 200
    assert "rss-news" in response.text


def test_an_unknown_file_is_not_found(client: TestClient) -> None:
    response = client.get(f"{PREFIX}/assets/missing.js")

    assert response.status_code == 404
