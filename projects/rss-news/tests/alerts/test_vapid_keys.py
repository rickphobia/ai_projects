import base64

import pytest

from rss_news.alerts.vapid_keys import (
    InvalidVapidKey,
    generate_vapid_private_key,
    parse_vapid_private_key,
)


def decoded(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def test_a_generated_key_gives_the_public_key_a_browser_subscribes_with() -> None:
    private = generate_vapid_private_key()

    key = parse_vapid_private_key(private)

    assert key.private_key == private
    # applicationServerKey is an uncompressed P-256 point: 0x04, then x and y.
    public = decoded(key.public_key)
    assert len(public) == 65
    assert public[0] == 0x04
    assert "=" not in key.public_key


def test_each_generated_key_is_new() -> None:
    assert generate_vapid_private_key() != generate_vapid_private_key()


def test_the_private_key_stays_out_of_its_repr() -> None:
    private = generate_vapid_private_key()

    assert private not in repr(parse_vapid_private_key(private))


@pytest.mark.parametrize(
    "text",
    [
        "not base64!",
        base64.urlsafe_b64encode(b"too short").decode(),
        # Zero is not a valid private key.
        base64.urlsafe_b64encode(bytes(32)).decode().rstrip("="),
    ],
)
def test_text_that_is_not_a_private_key_is_refused(text: str) -> None:
    with pytest.raises(InvalidVapidKey):
        parse_vapid_private_key(text)
