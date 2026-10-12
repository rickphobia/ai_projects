"""The VAPID key that signs every Web Push message, so push services know it comes from us.

Only the private key is configured: the public half, which the phone needs to subscribe, is
worked out from it, so the two can never disagree.
"""

import base64
import binascii
from dataclasses import dataclass, field

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

# A P-256 private key is one 32-byte number.
_PRIVATE_KEY_BYTES = 32


class InvalidVapidKey(Exception):
    """The text is not a VAPID private key from `rss-news vapid-key`."""


@dataclass(frozen=True)
class VapidKey:
    # The raw private number, base64url without padding.
    private_key: str = field(repr=False)
    # The uncompressed public point, base64url without padding: the browser's
    # applicationServerKey.
    public_key: str


def generate_vapid_private_key() -> str:
    """A new private key, in the form RSS_NEWS_VAPID_PRIVATE_KEY takes."""
    key = ec.generate_private_key(ec.SECP256R1())
    number = key.private_numbers().private_value
    return _b64url(number.to_bytes(_PRIVATE_KEY_BYTES, "big"))


def parse_vapid_private_key(text: str) -> VapidKey:
    try:
        raw = base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))
    except (binascii.Error, ValueError):
        raise InvalidVapidKey("it is not base64url text") from None
    if len(raw) != _PRIVATE_KEY_BYTES:
        raise InvalidVapidKey(f"it decodes to {len(raw)} bytes, not {_PRIVATE_KEY_BYTES}")
    try:
        key = ec.derive_private_key(int.from_bytes(raw, "big"), ec.SECP256R1())
    except ValueError:
        raise InvalidVapidKey("it is not a valid P-256 private key") from None
    public = key.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    return VapidKey(private_key=text, public_key=_b64url(public))


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()
