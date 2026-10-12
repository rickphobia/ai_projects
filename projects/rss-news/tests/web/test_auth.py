import logging
from datetime import timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from rss_news.config import Settings, load_settings
from rss_news.web.auth import SESSION_COOKIE
from tests.support import OWNER_PASSWORD, PREFIX, FakeClock, app_env, make_wiring

LOGIN = f"{PREFIX}/api/login"
LOGOUT = f"{PREFIX}/api/logout"
SESSION = f"{PREFIX}/api/session"


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return load_settings(
        app_env(
            tmp_path,
            RSS_NEWS_LOGIN_MAX_FAILURES="3",
            RSS_NEWS_LOGIN_LOCKOUT_MINUTES="15",
            RSS_NEWS_SESSION_DAYS="60",
        )
    )


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


def make_client(settings: Settings, clock: FakeClock) -> TestClient:
    """A fresh app over the same database file, as after a restart."""
    return TestClient(make_wiring(settings, clock).app)


@pytest.fixture
def client(settings: Settings, clock: FakeClock) -> TestClient:
    return make_client(settings, clock)


def fail_logins(client: TestClient, times: int) -> None:
    for _ in range(times):
        assert client.post(LOGIN, json={"password": "wrong"}).status_code == 401


def test_the_session_check_answers_401_without_a_session(client: TestClient) -> None:
    response = client.get(SESSION)

    assert response.status_code == 401


def test_logout_answers_401_without_a_session(client: TestClient) -> None:
    assert client.post(LOGOUT).status_code == 401


def test_healthz_needs_no_session(client: TestClient) -> None:
    assert client.get(f"{PREFIX}/healthz").status_code == 200


def test_the_right_password_starts_a_session(client: TestClient) -> None:
    response = client.post(LOGIN, json={"password": OWNER_PASSWORD})

    assert response.status_code == 204
    assert client.get(SESSION).status_code == 204


def test_the_session_cookie_is_httponly_strict_and_scoped_to_the_prefix(
    client: TestClient,
) -> None:
    response = client.post(LOGIN, json={"password": OWNER_PASSWORD})

    cookie = response.headers["set-cookie"]
    assert cookie.startswith(f"{SESSION_COOKIE}=")
    assert "HttpOnly" in cookie
    assert "SameSite=strict" in cookie
    assert f"Path={PREFIX}" in cookie
    assert f"Max-Age={60 * 24 * 3600}" in cookie


def test_the_cookie_is_secure_unless_turned_off(tmp_path: Path, clock: FakeClock) -> None:
    settings = load_settings(app_env(tmp_path, RSS_NEWS_SECURE_COOKIES="true"))

    response = make_client(settings, clock).post(LOGIN, json={"password": OWNER_PASSWORD})

    assert "Secure" in response.headers["set-cookie"]


def test_a_wrong_password_is_refused_without_a_session(client: TestClient) -> None:
    response = client.post(LOGIN, json={"password": "wrong"})

    assert response.status_code == 401
    assert response.json() == {"detail": "Wrong password."}
    assert SESSION_COOKIE not in response.cookies
    assert client.get(SESSION).status_code == 401


def test_logout_ends_the_session(client: TestClient) -> None:
    client.post(LOGIN, json={"password": OWNER_PASSWORD})

    assert client.post(LOGOUT).status_code == 204
    assert client.get(SESSION).status_code == 401


def test_the_session_expires_after_its_lifetime(client: TestClient, clock: FakeClock) -> None:
    client.post(LOGIN, json={"password": OWNER_PASSWORD})

    clock.advance(timedelta(days=59))
    assert client.get(SESSION).status_code == 204
    clock.advance(timedelta(days=1))
    assert client.get(SESSION).status_code == 401


def test_a_forged_cookie_is_refused(client: TestClient) -> None:
    client.cookies.set(SESSION_COOKIE, "v1.1791000000.0000", path=PREFIX)

    assert client.get(SESSION).status_code == 401


def test_repeated_failures_lock_out_even_the_right_password(client: TestClient) -> None:
    fail_logins(client, 3)

    response = client.post(LOGIN, json={"password": OWNER_PASSWORD})

    assert response.status_code == 429
    assert response.json() == {"detail": "Too many wrong passwords.", "minutes_left": 15}
    assert response.headers["retry-after"] == str(15 * 60)
    assert client.get(SESSION).status_code == 401


def test_the_lockout_survives_a_restart(settings: Settings, clock: FakeClock) -> None:
    fail_logins(make_client(settings, clock), 3)

    restarted = make_client(settings, clock)

    assert restarted.post(LOGIN, json={"password": OWNER_PASSWORD}).status_code == 429


def test_the_lockout_lifts_when_it_expires(client: TestClient, clock: FakeClock) -> None:
    fail_logins(client, 3)

    clock.advance(timedelta(minutes=14))
    assert client.post(LOGIN, json={"password": OWNER_PASSWORD}).status_code == 429
    clock.advance(timedelta(minutes=1))
    assert client.post(LOGIN, json={"password": OWNER_PASSWORD}).status_code == 204


def test_sign_ins_are_logged_without_the_password(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO)

    client.post(LOGIN, json={"password": "wrong-guess"})
    client.post(LOGIN, json={"password": OWNER_PASSWORD})

    levels = {record.getMessage(): record.levelname for record in caplog.records}
    assert levels["sign-in failed: wrong password"] == "WARNING"
    assert levels["owner signed in"] == "INFO"
    assert "wrong-guess" not in caplog.text
    assert OWNER_PASSWORD not in caplog.text
