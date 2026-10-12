"""Dictionary look-ups: the definition and its cost, the ledger row, the spending limit, and
what is refused."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from rss_news.config import load_settings
from rss_news.dictionary.lookup import DefinitionRequest, DictionaryFailed
from rss_news.spending.ledger import AiUsage, Feature
from rss_news.wiring import Wiring
from tests.support import (
    OWNER_PASSWORD,
    PREFIX,
    FakeClock,
    FakeLanguageModel,
    app_env,
    make_wiring,
)

DICTIONARY = f"{PREFIX}/api/dictionary"


@pytest.fixture
def model() -> FakeLanguageModel:
    return FakeLanguageModel()


@pytest.fixture
def wiring(tmp_path: Path, model: FakeLanguageModel) -> Wiring:
    settings = load_settings(app_env(tmp_path, RSS_NEWS_MONTHLY_LIMIT_USD="10"))
    return make_wiring(settings, FakeClock(), language_model=model)


@pytest.fixture
def client(wiring: Wiring) -> TestClient:
    client = TestClient(wiring.app)
    assert client.post(f"{PREFIX}/api/login", json={"password": OWNER_PASSWORD}).status_code == 204
    return client


def test_a_look_up_defines_the_term_in_its_context_and_records_the_call(
    client: TestClient, model: FakeLanguageModel, wiring: Wiring
) -> None:
    response = client.post(
        DICTIONARY, json={"term": "  kekalkan\n", "context": "BNM kekalkan   OPR pada 2.75%"}
    )

    assert response.status_code == 200
    # 400 input and 60 output tokens of Haiku at $0.10 and $0.50 per million.
    assert response.json() == {
        "term": "kekalkan",
        "definition": "Meaning of kekalkan.",
        "cost_usd": "0.0001",
    }
    assert model.definitions == [DefinitionRequest("kekalkan", "BNM kekalkan OPR pada 2.75%")]
    assert [call.feature for call in wiring.ledger.calls()] == [Feature.DICTIONARY]


def test_a_look_up_is_refused_at_the_spending_limit_without_calling_the_model(
    client: TestClient, model: FakeLanguageModel, wiring: Wiring
) -> None:
    for _ in range(10):
        wiring.ledger.record(
            Feature.BRIEFINGS,
            AiUsage("claude-opus-5-5", 250_000, 0, 0, model.DEFINITION_USAGE.duration),
        )

    response = client.post(DICTIONARY, json={"term": "OPR"})

    assert response.status_code == 429
    assert "Dictionary are off until next month" in response.json()["detail"]
    assert model.definitions == []


def test_a_failed_look_up_says_why_and_still_records_what_the_model_used(
    client: TestClient, model: FakeLanguageModel, wiring: Wiring
) -> None:
    model.definition_failure = DictionaryFailed("stop reason refusal", model.DEFINITION_USAGE)

    response = client.post(DICTIONARY, json={"term": "OPR"})

    assert response.status_code == 502
    assert response.json()["detail"] == "The Dictionary couldn't define it: stop reason refusal."
    assert [call.feature for call in wiring.ledger.calls()] == [Feature.DICTIONARY]


@pytest.mark.parametrize("term", ["   ", "", "x" * 101])
def test_a_blank_or_long_term_is_refused(
    client: TestClient, model: FakeLanguageModel, term: str
) -> None:
    assert client.post(DICTIONARY, json={"term": term}).status_code == 422
    assert model.definitions == []


def test_a_look_up_needs_a_session(wiring: Wiring) -> None:
    assert TestClient(wiring.app).post(DICTIONARY, json={"term": "OPR"}).status_code == 401
